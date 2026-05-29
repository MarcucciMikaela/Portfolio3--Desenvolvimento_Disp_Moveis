import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { SQLiteConnection, CapacitorSQLite, SQLiteDBConnection } from '@capacitor-community/sqlite';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private sqliteConnection!: SQLiteConnection;
  private dbConnection!: SQLiteDBConnection;
  private isNative: boolean = false;
  private isInitialized: boolean = false;

  // Web Emulator In-Memory Tables
  private mockDb: { [tableName: string]: any[] } = {};

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
  }

  /**
   * Initializes the database, creating tables and indices.
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    if (this.isNative) {
      try {
        this.sqliteConnection = new SQLiteConnection(CapacitorSQLite);
        this.dbConnection = await this.sqliteConnection.createConnection(
          'vendas_db',
          false,
          'no-encryption',
          1,
          false
        );
        await this.dbConnection.open();
        await this.createNativeTables();
        this.isInitialized = true;
        console.log('SQLite Database initialized on native platform.');
      } catch (err) {
        console.error('Failed to initialize SQLite on native platform. Falling back to mock...', err);
        this.setupMockDatabase();
        this.isInitialized = true;
      }
    } else {
      this.setupMockDatabase();
      this.isInitialized = true;
      console.log('SQLite Emulator initialized on Web Browser.');
    }
  }

  /**
   * Run a SQL query (SELECT)
   */
  async query(sql: string, params: any[] = []): Promise<any> {
    await this.init();
    if (this.isNative) {
      const res = await this.dbConnection.query(sql, params);
      return res.values || [];
    } else {
      return this.executeMockQuery(sql, params);
    }
  }

  /**
   * Execute a SQL command (INSERT, UPDATE, DELETE)
   */
  async execute(sql: string, params: any[] = []): Promise<any> {
    await this.init();
    if (this.isNative) {
      const res = await this.dbConnection.run(sql, params);
      return res.changes;
    } else {
      return this.executeMockMutation(sql, params);
    }
  }

  /**
   * Execute a transactional block.
   */
  async transaction(callback: (db: DatabaseService) => Promise<void>): Promise<void> {
    await this.init();
    if (this.isNative) {
      // Native transaction
      try {
        await this.dbConnection.execute('BEGIN TRANSACTION;');
        await callback(this);
        await this.dbConnection.execute('COMMIT;');
      } catch (err) {
        await this.dbConnection.execute('ROLLBACK;');
        throw err;
      }
    } else {
      // Browser transaction (backup mockDb state, rollback if failed)
      const backup = JSON.stringify(this.mockDb);
      try {
        await callback(this);
        this.saveMockDb();
      } catch (err) {
        this.mockDb = JSON.parse(backup);
        this.saveMockDb();
        throw err;
      }
    }
  }

  // ==========================================
  // NATIVE SQLITE TABLE CREATION
  // ==========================================
  private async createNativeTables(): Promise<void> {
    const tableQueries = [
      `CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        login TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        cpf TEXT UNIQUE NOT NULL,
        email TEXT,
        telefone TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS produtos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        preco_venda REAL NOT NULL,
        quantidade_estoque INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS vendas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER NOT NULL,
        data_venda TEXT NOT NULL,
        valor_total REAL NOT NULL,
        FOREIGN KEY(cliente_id) REFERENCES clientes(id)
      );`,
      `CREATE TABLE IF NOT EXISTS itens_venda (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venda_id INTEGER NOT NULL,
        produto_id INTEGER NOT NULL,
        quantidade INTEGER NOT NULL,
        preco_unitario REAL NOT NULL,
        FOREIGN KEY(venda_id) REFERENCES vendas(id),
        FOREIGN KEY(produto_id) REFERENCES produtos(id)
      );`,
      `CREATE TABLE IF NOT EXISTS financeiro_receber (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venda_id INTEGER NOT NULL,
        data_vencimento TEXT NOT NULL,
        valor REAL NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('Pendente', 'Pago')),
        FOREIGN KEY(venda_id) REFERENCES vendas(id)
      );`,
      `CREATE TABLE IF NOT EXISTS vendas_canceladas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venda_id INTEGER NOT NULL,
        cliente_nome TEXT NOT NULL,
        data_venda TEXT NOT NULL,
        valor_total REAL NOT NULL,
        justificativa TEXT NOT NULL,
        data_cancelamento TEXT NOT NULL
      );`,
      // Indexes
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_login ON usuarios(login);`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_cpf ON clientes(cpf);`,
      `CREATE INDEX IF NOT EXISTS idx_vendas_cliente ON vendas(cliente_id);`,
      `CREATE INDEX IF NOT EXISTS idx_itens_venda_venda ON itens_venda(venda_id);`,
      `CREATE INDEX IF NOT EXISTS idx_itens_venda_produto ON itens_venda(produto_id);`,
      `CREATE INDEX IF NOT EXISTS idx_financeiro_venda ON financeiro_receber(venda_id);`,
      `CREATE INDEX IF NOT EXISTS idx_canceladas_venda ON vendas_canceladas(venda_id);`
    ];

    for (const query of tableQueries) {
      await this.dbConnection.execute(query);
    }

    // Seed default admin user if none exists
    const users = await this.dbConnection.query('SELECT * FROM usuarios;');
    if (!users.values || users.values.length === 0) {
      await this.dbConnection.run(
        'INSERT INTO usuarios (nome, login, senha) VALUES (?, ?, ?);',
        ['Administrador', 'admin', 'admin']
      );
    }
  }

  // ==========================================
  // WEB SQLITE EMULATOR (MOCK ENGINE)
  // ==========================================
  private setupMockDatabase(): void {
    const stored = localStorage.getItem('vendas_db_emulator');
    if (stored) {
      try {
        this.mockDb = JSON.parse(stored);
      } catch (e) {
        this.mockDb = {};
      }
    }

    // Initialize collections
    const tables = ['usuarios', 'clientes', 'produtos', 'vendas', 'itens_venda', 'financeiro_receber', 'vendas_canceladas'];
    for (const table of tables) {
      if (!this.mockDb[table]) {
        this.mockDb[table] = [];
      }
    }

    // Seed Admin User
    if (this.mockDb['usuarios'].length === 0) {
      this.mockDb['usuarios'].push({
        id: 1,
        nome: 'Administrador',
        login: 'admin',
        senha: 'admin'
      });
    }

    // Seed some initial products and clients if empty to make UI testable
    if (this.mockDb['produtos'].length === 0) {
      this.mockDb['produtos'].push(
        { id: 1, nome: 'Smartphone Android', preco_venda: 1499.90, quantidade_estoque: 15 },
        { id: 2, nome: 'Notebook Pro 15', preco_venda: 4500.00, quantidade_estoque: 5 },
        { id: 3, nome: 'Fone de Ouvido Bluetooth', preco_venda: 189.90, quantidade_estoque: 50 },
        { id: 4, nome: 'Teclado Mecânico Gamer', preco_venda: 349.90, quantidade_estoque: 8 }
      );
    }

    if (this.mockDb['clientes'].length === 0) {
      this.mockDb['clientes'].push(
        { id: 1, nome: 'João da Silva', cpf: '123.456.789-00', email: 'joao@email.com', telefone: '(11) 99999-9999' },
        { id: 2, nome: 'Maria Santos', cpf: '987.654.321-11', email: 'maria@email.com', telefone: '(21) 98888-8888' }
      );
    }

    this.saveMockDb();
  }

  private saveMockDb(): void {
    localStorage.setItem('vendas_db_emulator', JSON.stringify(this.mockDb));
  }

  private executeMockQuery(sql: string, params: any[]): any[] {
    const cleaned = sql.replace(/\s+/g, ' ').trim();

    // 1. SELECT * FROM usuarios WHERE login = ? AND senha = ?
    if (cleaned.match(/SELECT \* FROM usuarios WHERE login = \? AND senha = \?/i)) {
      const [login, senha] = params;
      return this.mockDb['usuarios'].filter(u => u.login === login && u.senha === senha);
    }

    // 2. SELECT FROM usuarios
    if (cleaned.toLowerCase().includes('from usuarios')) {
      return [...this.mockDb['usuarios']].sort((a, b) => a.nome.localeCompare(b.nome));
    }

    // 3. SELECT FROM clientes
    if (cleaned.toLowerCase().includes('from clientes') && !cleaned.toLowerCase().includes('inner join')) {
      // Sort alphabetically by name
      return [...this.mockDb['clientes']].sort((a, b) => a.nome.localeCompare(b.nome));
    }

    // 4. SELECT FROM produtos
    if (cleaned.toLowerCase().includes('from produtos') && !cleaned.toLowerCase().includes('inner join')) {
      return [...this.mockDb['produtos']].sort((a, b) => a.nome.localeCompare(b.nome));
    }

    // 5. INNER JOIN QUERY (Sales Report)
    // SELECT v.id, c.nome as cliente_nome, v.data_venda, v.valor_total, f.status as financeiro_status FROM vendas v INNER JOIN clientes c ON v.cliente_id = c.id INNER JOIN financeiro_receber f ON f.venda_id = v.id
    if (cleaned.toLowerCase().includes('from vendas') && cleaned.toLowerCase().includes('inner join')) {
      const results: any[] = [];
      const vendas = this.mockDb['vendas'];
      const clientes = this.mockDb['clientes'];
      const financeiro = this.mockDb['financeiro_receber'];

      for (const v of vendas) {
        const c = clientes.find(client => client.id === v.cliente_id);
        const f = financeiro.find(fin => fin.venda_id === v.id);

        results.push({
          id: v.id,
          cliente_nome: c ? c.nome : 'Cliente Removido',
          data_venda: v.data_venda,
          valor_total: v.valor_total,
          financeiro_status: f ? f.status : 'N/A'
        });
      }
      // Sort newest sales first
      return results.reverse();
    }

    // 6. SELECT iv.id, p.nome as produto_nome, iv.quantidade, iv.preco_unitario FROM itens_venda iv ... WHERE iv.venda_id = ?
    if (cleaned.toLowerCase().includes('from itens_venda') && cleaned.toLowerCase().includes('inner join')) {
      const [vendaId] = params;
      const itens = this.mockDb['itens_venda'].filter(item => item.venda_id === Number(vendaId));
      const produtos = this.mockDb['produtos'];

      return itens.map(item => {
        const p = produtos.find(prod => prod.id === item.produto_id);
        return {
          id: item.id,
          produto_id: item.produto_id,
          produto_nome: p ? p.nome : 'Produto Desconhecido',
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario
        };
      });
    }

    // 7. General SELECT by id
    const selectByIdMatch = cleaned.match(/SELECT\s+(.*?)\s+FROM\s+(\w+)\s+WHERE\s+id\s*=\s*\?/i);
    if (selectByIdMatch) {
      const tableName = selectByIdMatch[2];
      const [id] = params;
      return this.mockDb[tableName]?.filter(row => row.id === Number(id)) || [];
    }

    // 7.5. SELECT id FROM vendas ORDER BY id DESC LIMIT 1
    if (cleaned.toLowerCase().includes('select id from vendas order by id desc')) {
      return [...this.mockDb['vendas']]
        .sort((a, b) => b.id - a.id)
        .map(v => ({ id: v.id }));
    }

    // 7.6. SELECT * FROM vendas_canceladas
    if (cleaned.toLowerCase().includes('select * from vendas_canceladas')) {
      return [...this.mockDb['vendas_canceladas']].reverse();
    }

    console.warn('SQLite Emulator: Unhandled query selector. Returning empty array.', sql);
    return [];
  }

  private executeMockMutation(sql: string, params: any[]): any {
    const cleaned = sql.replace(/\s+/g, ' ').trim();

    // 1. INSERT INTO usuarios (nome, login, senha) VALUES (?, ?, ?)
    if (cleaned.match(/INSERT INTO usuarios \(([^)]+)\) VALUES \(([^)]+)\)/i)) {
      const [nome, login, senha] = params;
      // Check UNIQUE constraint
      const exists = this.mockDb['usuarios'].some(u => u.login === login);
      if (exists) {
        throw new Error('Constraint UNIQUE failed: usuarios.login');
      }
      const newId = this.getNextId('usuarios');
      this.mockDb['usuarios'].push({ id: newId, nome, login, senha });
      this.saveMockDb();
      return { changes: 1, lastId: newId };
    }

    // 2. INSERT INTO clientes (nome, cpf, email, telefone) VALUES (?, ?, ?, ?)
    if (cleaned.match(/INSERT INTO clientes \(([^)]+)\) VALUES \(([^)]+)\)/i)) {
      const [nome, cpf, email, telefone] = params;
      // Check UNIQUE constraint
      const exists = this.mockDb['clientes'].some(c => c.cpf === cpf);
      if (exists) {
        throw new Error('Constraint UNIQUE failed: clientes.cpf');
      }
      const newId = this.getNextId('clientes');
      this.mockDb['clientes'].push({ id: newId, nome, cpf, email, telefone });
      this.saveMockDb();
      return { changes: 1, lastId: newId };
    }

    // 3. INSERT INTO produtos (nome, preco_venda, quantidade_estoque) VALUES (?, ?, ?)
    if (cleaned.match(/INSERT INTO produtos \(([^)]+)\) VALUES \(([^)]+)\)/i)) {
      const [nome, preco_venda, quantidade_estoque] = params;
      const newId = this.getNextId('produtos');
      this.mockDb['produtos'].push({ id: newId, nome, preco_venda: Number(preco_venda), quantidade_estoque: Number(quantidade_estoque) });
      this.saveMockDb();
      return { changes: 1, lastId: newId };
    }

    // 4. INSERT INTO vendas (cliente_id, data_venda, valor_total) VALUES (?, ?, ?)
    if (cleaned.match(/INSERT INTO vendas \(([^)]+)\) VALUES \(([^)]+)\)/i)) {
      const [cliente_id, data_venda, valor_total] = params;
      const newId = this.getNextId('vendas');
      this.mockDb['vendas'].push({ id: newId, cliente_id: Number(cliente_id), data_venda, valor_total: Number(valor_total) });
      this.saveMockDb();
      return { changes: 1, lastId: newId };
    }

    // 5. INSERT INTO itens_venda (venda_id, produto_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)
    if (cleaned.match(/INSERT INTO itens_venda \(([^)]+)\) VALUES \(([^)]+)\)/i)) {
      const [venda_id, produto_id, quantidade, preco_unitario] = params;
      const newId = this.getNextId('itens_venda');
      this.mockDb['itens_venda'].push({
        id: newId,
        venda_id: Number(venda_id),
        produto_id: Number(produto_id),
        quantidade: Number(quantidade),
        preco_unitario: Number(preco_unitario)
      });
      this.saveMockDb();
      return { changes: 1, lastId: newId };
    }

    // 6. INSERT INTO financeiro_receber (venda_id, data_vencimento, valor, status) VALUES (?, ?, ?, ?)
    if (cleaned.match(/INSERT INTO financeiro_receber \(([^)]+)\) VALUES \(([^)]+)\)/i)) {
      const [venda_id, data_vencimento, valor, status] = params;
      const newId = this.getNextId('financeiro_receber');
      this.mockDb['financeiro_receber'].push({
        id: newId,
        venda_id: Number(venda_id),
        data_vencimento,
        valor: Number(valor),
        status
      });
      this.saveMockDb();
      return { changes: 1, lastId: newId };
    }

    // 7. UPDATE produtos SET quantidade_estoque = ? WHERE id = ?
    if (cleaned.match(/UPDATE produtos SET quantidade_estoque = \? WHERE id = \?/i)) {
      const [quantidade, id] = params;
      const p = this.mockDb['produtos'].find(prod => prod.id === Number(id));
      if (p) {
        p.quantidade_estoque = Number(quantidade);
        this.saveMockDb();
        return 1;
      }
      return 0;
    }

    // 7.5. UPDATE financeiro_receber SET status = ? WHERE venda_id = ?
    if (cleaned.match(/UPDATE financeiro_receber SET status = \? WHERE venda_id = \?/i)) {
      const [status, vendaId] = params;
      const fin = this.mockDb['financeiro_receber'].find(f => f.venda_id === Number(vendaId));
      if (fin) {
        fin.status = status;
        this.saveMockDb();
        return 1;
      }
      return 0;
    }

    // 7.6. INSERT INTO vendas_canceladas (venda_id, cliente_nome, data_venda, valor_total, justificativa, data_cancelamento) VALUES (?, ?, ?, ?, ?, ?)
    if (cleaned.match(/INSERT INTO vendas_canceladas \(([^)]+)\) VALUES \(([^)]+)\)/i)) {
      const [venda_id, cliente_nome, data_venda, valor_total, justificativa, data_cancelamento] = params;
      const newId = this.getNextId('vendas_canceladas');
      this.mockDb['vendas_canceladas'].push({
        id: newId,
        venda_id: Number(venda_id),
        cliente_nome,
        data_venda,
        valor_total: Number(valor_total),
        justificativa,
        data_cancelamento
      });
      this.saveMockDb();
      return { changes: 1, lastId: newId };
    }

    // 7.7. DELETE FROM financeiro_receber WHERE venda_id = ?
    if (cleaned.toLowerCase().includes('delete from financeiro_receber where venda_id = ?')) {
      const [vendaId] = params;
      this.mockDb['financeiro_receber'] = this.mockDb['financeiro_receber'].filter(f => f.venda_id !== Number(vendaId));
      this.saveMockDb();
      return 1;
    }

    // 7.8. DELETE FROM itens_venda WHERE venda_id = ?
    if (cleaned.toLowerCase().includes('delete from itens_venda where venda_id = ?')) {
      const [vendaId] = params;
      this.mockDb['itens_venda'] = this.mockDb['itens_venda'].filter(item => item.venda_id !== Number(vendaId));
      this.saveMockDb();
      return 1;
    }

    // 7.9. DELETE FROM vendas WHERE id = ?
    if (cleaned.toLowerCase().includes('delete from vendas where id = ?')) {
      const [vendaId] = params;
      this.mockDb['vendas'] = this.mockDb['vendas'].filter(v => v.id !== Number(vendaId));
      this.saveMockDb();
      return 1;
    }

    // 7.91. UPDATE usuarios SET nome = ?, login = ?, senha = ? WHERE id = ?
    if (cleaned.match(/UPDATE usuarios SET nome = \?, login = \?, senha = \? WHERE id = \?/i)) {
      const [nome, login, senha, id] = params;
      const exists = this.mockDb['usuarios'].some(u => u.login === login && u.id !== Number(id));
      if (exists) {
        throw new Error('Constraint UNIQUE failed: usuarios.login');
      }
      const u = this.mockDb['usuarios'].find(user => user.id === Number(id));
      if (u) {
        u.nome = nome;
        u.login = login;
        u.senha = senha;
        this.saveMockDb();
        return 1;
      }
      return 0;
    }

    // 7.92. UPDATE usuarios SET nome = ?, login = ? WHERE id = ?
    if (cleaned.match(/UPDATE usuarios SET nome = \?, login = \? WHERE id = \?/i)) {
      const [nome, login, id] = params;
      const exists = this.mockDb['usuarios'].some(u => u.login === login && u.id !== Number(id));
      if (exists) {
        throw new Error('Constraint UNIQUE failed: usuarios.login');
      }
      const u = this.mockDb['usuarios'].find(user => user.id === Number(id));
      if (u) {
        u.nome = nome;
        u.login = login;
        this.saveMockDb();
        return 1;
      }
      return 0;
    }

    // 7.93. UPDATE clientes SET nome = ?, cpf = ?, email = ?, telefone = ? WHERE id = ?
    if (cleaned.match(/UPDATE clientes SET nome = \?, cpf = \?, email = \?, telefone = \? WHERE id = \?/i)) {
      const [nome, cpf, email, telefone, id] = params;
      const exists = this.mockDb['clientes'].some(c => c.cpf === cpf && c.id !== Number(id));
      if (exists) {
        throw new Error('Constraint UNIQUE failed: clientes.cpf');
      }
      const c = this.mockDb['clientes'].find(client => client.id === Number(id));
      if (c) {
        c.nome = nome;
        c.cpf = cpf;
        c.email = email;
        c.telefone = telefone;
        this.saveMockDb();
        return 1;
      }
      return 0;
    }

    // 7.94. DELETE FROM usuarios WHERE id = ?
    if (cleaned.toLowerCase().includes('delete from usuarios where id = ?')) {
      const [id] = params;
      this.mockDb['usuarios'] = this.mockDb['usuarios'].filter(u => u.id !== Number(id));
      this.saveMockDb();
      return 1;
    }

    // 7.95. DELETE FROM clientes WHERE id = ?
    if (cleaned.toLowerCase().includes('delete from clientes where id = ?')) {
      const [id] = params;
      this.mockDb['clientes'] = this.mockDb['clientes'].filter(c => c.id !== Number(id));
      this.saveMockDb();
      return 1;
    }

    // 8. General tables clear / resets for testing (optional)
    if (cleaned.toLowerCase().startsWith('delete from')) {
      const tableName = cleaned.split(' ')[2];
      if (this.mockDb[tableName]) {
        this.mockDb[tableName] = [];
        this.saveMockDb();
        return 1;
      }
    }

    console.warn('SQLite Emulator: Unhandled mutation query. Returning 0 changes.', sql);
    return 0;
  }

  private getNextId(tableName: string): number {
    const list = this.mockDb[tableName] || [];
    if (list.length === 0) return 1;
    return Math.max(...list.map(item => item.id)) + 1;
  }
}
