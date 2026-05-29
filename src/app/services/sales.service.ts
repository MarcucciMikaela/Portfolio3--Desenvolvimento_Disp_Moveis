import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';

export interface ItemVendaInput {
  produto_id: number;
  quantidade: number;
  preco_unitario: number;
}

export interface VendaInput {
  cliente_id: number;
  data_venda: string;
  valor_total: number;
  itens: ItemVendaInput[];
}

@Injectable({
  providedIn: 'root'
})
export class SalesService {
  constructor(private db: DatabaseService) {}

  /**
   * Completes a sale transaction.
   * Performs validation, inserts header, inserts items, updates stock, and registers account receivable.
   */
  async checkout(venda: VendaInput): Promise<void> {
    if (venda.itens.length === 0) {
      throw new Error('Nenhum item adicionado à venda.');
    }

    // Step A: Pre-check stock for all products to avoid half-complete transactions
    for (const item of venda.itens) {
      const p = await this.db.query('SELECT * FROM produtos WHERE id = ?', [item.produto_id]);
      if (!p || p.length === 0) {
        throw new Error('Um dos produtos não foi encontrado.');
      }
      const produto = p[0];
      if (produto.quantidade_estoque < item.quantidade) {
        throw new Error(`Estoque insuficiente para o produto "${produto.nome}". Disponível: ${produto.quantidade_estoque}. Solicitado: ${item.quantidade}.`);
      }
    }

    // Run within a SQL transaction block
    await this.db.transaction(async (tx) => {
      // Step B: Insert header in 'vendas'
      const vendaRes = await tx.execute(
        'INSERT INTO vendas (cliente_id, data_venda, valor_total) VALUES (?, ?, ?)',
        [venda.cliente_id, venda.data_venda, venda.valor_total]
      );
      
      // Obtain generated venda ID
      // On native it is stored in the result, on emulator we can search for the last sale or query it.
      // But we can query the max id or our emulator's mock engine returns lastId in the result object, or we can select max(id).
      // Let's perform a query to find the newly inserted sale ID safely in both platforms
      const lastVendas = await tx.query('SELECT id FROM vendas ORDER BY id DESC LIMIT 1');
      if (!lastVendas || lastVendas.length === 0) {
        throw new Error('Erro ao recuperar o ID da venda gerada.');
      }
      const vendaId = lastVendas[0].id;

      for (const item of venda.itens) {
        // Step B: Insert item in 'itens_venda'
        await tx.execute(
          'INSERT INTO itens_venda (venda_id, produto_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)',
          [vendaId, item.produto_id, item.quantidade, item.preco_unitario]
        );

        // Step C: Update quantity in 'produtos'
        const p = await tx.query('SELECT quantidade_estoque FROM produtos WHERE id = ?', [item.produto_id]);
        const newStock = p[0].quantidade_estoque - item.quantidade;
        await tx.execute('UPDATE produtos SET quantidade_estoque = ? WHERE id = ?', [newStock, item.produto_id]);
      }

      // Step D: Insert record in 'financeiro_receber' with 'Pendente' status
      // We will set vencimento to 30 days from now, or just the same date
      const dataVencimento = this.addDaysToIsoString(venda.data_venda, 30);
      await tx.execute(
        'INSERT INTO financeiro_receber (venda_id, data_vencimento, valor, status) VALUES (?, ?, ?, ?)',
        [vendaId, dataVencimento, venda.valor_total, 'Pendente']
      );
    });
  }

  /**
   * Returns a list of all sales with client details and financial status.
   */
  async getSalesReport(): Promise<any[]> {
    return await this.db.query(
      `SELECT v.id, c.nome as cliente_nome, v.data_venda, v.valor_total, f.status as financeiro_status
       FROM vendas v
       INNER JOIN clientes c ON v.cliente_id = c.id
       INNER JOIN financeiro_receber f ON f.venda_id = v.id
       ORDER BY v.id DESC`
    );
  }

  /**
   * Returns the items of a specific sale.
   */
  async getSaleItems(vendaId: number): Promise<any[]> {
    return await this.db.query(
      `SELECT iv.id, iv.produto_id, p.nome as produto_nome, iv.quantidade, iv.preco_unitario
       FROM itens_venda iv
       INNER JOIN produtos p ON iv.produto_id = p.id
       WHERE iv.venda_id = ?`,
      [vendaId]
    );
  }

  /**
   * Cancels a sale, restores stock, logs justification, and deletes active records.
   */
  async cancelSale(vendaId: number, justificativa: string): Promise<void> {
    // 1. Get sale details (client name, total value, date)
    const sales = await this.db.query(
      `SELECT v.id, c.nome as cliente_nome, v.data_venda, v.valor_total
       FROM vendas v
       INNER JOIN clientes c ON v.cliente_id = c.id
       WHERE v.id = ?`,
      [vendaId]
    );
    if (!sales || sales.length === 0) {
      throw new Error('Venda não encontrada.');
    }
    const sale = sales[0];

    // 2. Get sale items to return stock
    const items = await this.getSaleItems(vendaId);

    // 3. Execute transaction
    await this.db.transaction(async (tx) => {
      // Step A: Insert into vendas_canceladas
      const todayStr = new Date().toISOString().split('T')[0];
      await tx.execute(
        `INSERT INTO vendas_canceladas (venda_id, cliente_nome, data_venda, valor_total, justificativa, data_cancelamento)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [vendaId, sale.cliente_nome, sale.data_venda, sale.valor_total, justificativa, todayStr]
      );

      // Step B: Return product stock
      for (const item of items) {
        const pId = item.produto_id;
        const p = await tx.query('SELECT quantidade_estoque FROM produtos WHERE id = ?', [pId]);
        if (p && p.length > 0) {
          const newStock = p[0].quantidade_estoque + item.quantidade;
          await tx.execute('UPDATE produtos SET quantidade_estoque = ? WHERE id = ?', [newStock, pId]);
        }
      }

      // Step C: Delete related records
      await tx.execute('DELETE FROM financeiro_receber WHERE venda_id = ?', [vendaId]);
      await tx.execute('DELETE FROM itens_venda WHERE venda_id = ?', [vendaId]);
      await tx.execute('DELETE FROM vendas WHERE id = ?', [vendaId]);
    });
  }

  /**
   * Returns all canceled sales.
   */
  async getCanceledSales(): Promise<any[]> {
    return await this.db.query('SELECT * FROM vendas_canceladas ORDER BY id DESC');
  }

  /**
   * Marks the account receivable for a sale as Paid.
   */
  async payBill(vendaId: number): Promise<void> {
    await this.db.execute(
      "UPDATE financeiro_receber SET status = 'Pago' WHERE venda_id = ?",
      [vendaId]
    );
  }

  /**
   * Helper to format expiry date (+30 days)
   */
  private addDaysToIsoString(dateStr: string, days: number): string {
    try {
      const date = new Date(dateStr);
      date.setDate(date.getDate() + days);
      return date.toISOString().split('T')[0];
    } catch {
      // Fallback
      return dateStr;
    }
  }
}
