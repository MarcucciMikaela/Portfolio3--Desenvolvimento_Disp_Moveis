import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private activeUser: any = null;

  constructor(private db: DatabaseService) {
    const savedUser = sessionStorage.getItem('active_user');
    if (savedUser) {
      try {
        this.activeUser = JSON.parse(savedUser);
      } catch (e) {
        this.activeUser = null;
      }
    }
  }

  /**
   * Validates user credentials against the database.
   */
  async login(login: string, senha: string): Promise<boolean> {
    const users = await this.db.query(
      'SELECT * FROM usuarios WHERE login = ? AND senha = ?',
      [login, senha]
    );

    if (users && users.length > 0) {
      this.activeUser = {
        id: users[0].id,
        nome: users[0].nome,
        login: users[0].login
      };
      sessionStorage.setItem('active_user', JSON.stringify(this.activeUser));
      return true;
    }

    return false;
  }

  /**
   * Logouts the active user.
   */
  logout(): void {
    this.activeUser = null;
    sessionStorage.removeItem('active_user');
  }

  /**
   * Checks if user is logged in.
   */
  isLoggedIn(): boolean {
    return this.activeUser !== null;
  }

  /**
   * Returns current active user info.
   */
  getCurrentUser(): any {
    return this.activeUser;
  }

  /**
   * Creates a new user in the database.
   */
  async registerUser(nome: string, login: string, senha: string): Promise<void> {
    try {
      await this.db.execute(
        'INSERT INTO usuarios (nome, login, senha) VALUES (?, ?, ?)',
        [nome, login, senha]
      );
    } catch (err: any) {
      if (err.message?.includes('UNIQUE') || err.message?.includes('constraint')) {
        throw new Error('Este login de usuário já está sendo utilizado.');
      }
      throw err;
    }
  }

  /**
   * Returns a list of all registered users.
   */
  async getUsers(): Promise<any[]> {
    return await this.db.query('SELECT id, nome, login FROM usuarios ORDER BY nome ASC');
  }

  /**
   * Updates an existing user's name and login (and optionally password if provided).
   */
  async updateUser(id: number, nome: string, login: string, senha?: string): Promise<void> {
    try {
      if (senha && senha.trim() !== '') {
        await this.db.execute(
          'UPDATE usuarios SET nome = ?, login = ?, senha = ? WHERE id = ?',
          [nome, login, senha, id]
        );
      } else {
        await this.db.execute(
          'UPDATE usuarios SET nome = ?, login = ? WHERE id = ?',
          [nome, login, id]
        );
      }
    } catch (err: any) {
      if (err.message?.includes('UNIQUE') || err.message?.includes('constraint')) {
        throw new Error('Este login de usuário já está sendo utilizado.');
      }
      throw err;
    }
  }

  /**
   * Deletes a user by ID.
   */
  async deleteUser(id: number): Promise<void> {
    await this.db.execute('DELETE FROM usuarios WHERE id = ?', [id]);
  }
}
