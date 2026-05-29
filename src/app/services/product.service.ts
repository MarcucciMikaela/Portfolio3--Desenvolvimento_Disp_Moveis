import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';

export interface Produto {
  id?: number;
  nome: string;
  preco_venda: number;
  quantidade_estoque: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  constructor(private db: DatabaseService) {}

  /**
   * Retrieves all products sorted alphabetically.
   */
  async getProducts(): Promise<Produto[]> {
    return await this.db.query('SELECT * FROM produtos');
  }

  /**
   * Retrieves a single product by ID.
   */
  async getProductById(id: number): Promise<Produto | null> {
    const res = await this.db.query('SELECT * FROM produtos WHERE id = ?', [id]);
    return res && res.length > 0 ? res[0] : null;
  }

  /**
   * Creates a new product.
   */
  async createProduct(produto: Produto): Promise<void> {
    await this.db.execute(
      'INSERT INTO produtos (nome, preco_venda, quantidade_estoque) VALUES (?, ?, ?)',
      [produto.nome, produto.preco_venda, produto.quantidade_estoque]
    );
  }

  /**
   * Updates an existing product.
   */
  async updateProduct(produto: Produto): Promise<void> {
    if (!produto.id) throw new Error('ID do produto é obrigatório para atualização.');
    await this.db.execute(
      'UPDATE produtos SET nome = ?, preco_venda = ?, quantidade_estoque = ? WHERE id = ?',
      [produto.nome, produto.preco_venda, produto.quantidade_estoque, produto.id]
    );
  }

  /**
   * Directly updates stock quantity.
   */
  async updateStock(id: number, quantity: number): Promise<void> {
    await this.db.execute(
      'UPDATE produtos SET quantidade_estoque = ? WHERE id = ?',
      [quantity, id]
    );
  }

  /**
   * Deletes a product.
   */
  async deleteProduct(id: number): Promise<void> {
    await this.db.execute('DELETE FROM produtos WHERE id = ?', [id]);
  }
}
