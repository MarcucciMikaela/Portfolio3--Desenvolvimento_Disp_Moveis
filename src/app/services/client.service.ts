import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';

export interface Cliente {
  id?: number;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
}

@Injectable({
  providedIn: 'root'
})
export class ClientService {
  constructor(private db: DatabaseService) {}

  /**
   * Retrieves all clients sorted alphabetically.
   */
  async getClients(): Promise<Cliente[]> {
    return await this.db.query('SELECT * FROM clientes');
  }

  /**
   * Retrieves a single client by ID.
   */
  async getClientById(id: number): Promise<Cliente | null> {
    const res = await this.db.query('SELECT * FROM clientes WHERE id = ?', [id]);
    return res && res.length > 0 ? res[0] : null;
  }

  /**
   * Registers a new client, explicitly handling CPF constraint conflicts.
   */
  async createClient(cliente: Cliente): Promise<void> {
    try {
      await this.db.execute(
        'INSERT INTO clientes (nome, cpf, email, telefone) VALUES (?, ?, ?, ?)',
        [cliente.nome, cliente.cpf, cliente.email || '', cliente.telefone || '']
      );
    } catch (err: any) {
      // Check for SQLite UNIQUE constraint violation on clientes.cpf
      if (err.message?.includes('UNIQUE') || err.message?.includes('constraint')) {
        throw new Error('CLIENTE_JA_CADASTRADO');
      }
      throw err;
    }
  }

  /**
   * Updates an existing client's info.
   */
  async updateClient(cliente: Cliente): Promise<void> {
    if (!cliente.id) throw new Error('ID do cliente é obrigatório para atualização.');
    try {
      await this.db.execute(
        'UPDATE clientes SET nome = ?, cpf = ?, email = ?, telefone = ? WHERE id = ?',
        [cliente.nome, cliente.cpf, cliente.email, cliente.telefone, cliente.id]
      );
    } catch (err: any) {
      if (err.message?.includes('UNIQUE') || err.message?.includes('constraint')) {
        throw new Error('CLIENTE_JA_CADASTRADO');
      }
      throw err;
    }
  }

  /**
   * Deletes a client by ID.
   */
  async deleteClient(id: number): Promise<void> {
    await this.db.execute('DELETE FROM clientes WHERE id = ?', [id]);
  }
}
