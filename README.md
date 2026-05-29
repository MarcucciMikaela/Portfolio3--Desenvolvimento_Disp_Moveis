# 📱 Sistema de Vendas Mobile (Portfólio Acadêmico)

Este repositório contém o código-fonte de um aplicativo móvel voltado para a **Gestão Comercial, Controle de Estoque de Alta Capacidade e Validação Cadastral**. O projeto foi concebido seguindo padrões arquiteturais rigorosos e focado em cenários corporativos reais.

---

## 🛠️ Pilha Tecnológica (Tech Stack)

* **Framework Mobile:** Ionic Framework (com Angular) utilizando *Standalone Components* e injeção de dependência avançada.
* **Banco de Dados Local:** SQLite local de alta performance, estruturado com índices de busca para suportar tabelas com grandes volumes de registros (garantindo escalabilidade local)[cite: 3].
* **UI/UX (Design System):** Interface customizada através do sistema de design do Ionic, baseada estritamente em **tons de verde** para conferir uma identidade visual moderna, executiva e de alta legibilidade[cite: 3].

---

## 🗃️ Arquitetura do Banco de Dados Otimizada

Para garantir que o banco armazene múltiplos objetos de forma eficiente e impeça a duplicidade de dados, a modelagem de dados no SQLite foi refinada com as seguintes restrições relacionais e índices estratégicos[cite: 3]:

| Tabela | Atributos / Campos | Tipo de Dado | Restrições / Notas |
| :--- | :--- | :--- | :--- |
| **`usuarios`** | id (PK), nome, login, senha | INTEGER, TEXT, TEXT, TEXT | `UNIQUE` no campo login. Índice criado para autenticação rápida[cite: 3]. |
| **`clientes`** | id (PK), nome, cpf, email, telefone | INTEGER, TEXT, TEXT, TEXT, TEXT | `UNIQUE` no campo CPF. Chave única de acesso que impede duplicidade[cite: 3]. |
| **`produtos`** | id (PK), nome, preco_venda, quantidade_estoque | INTEGER, TEXT, REAL, INTEGER | Suporta grandes volumes de estoque e catalogação de itens[cite: 3]. |
| **`vendas`** | id (PK), cliente_id (FK), data_venda, valor_total | INTEGER, INTEGER, TEXT, REAL | Relacionamento indexado para histórico ágil[cite: 3]. |
| **`itens_venda`** | id (PK), venda_id (FK), produto_id (FK), quantidade, preco_unitario | INTEGER, INTEGER, INTEGER, INTEGER, REAL | Indexação por ID da venda para otimizar relatórios de grande porte[cite: 3]. |
| **`financeiro_receber`** | id (PK), venda_id (FK), data_vencimento, valor, status | INTEGER, INTEGER, TEXT, REAL, TEXT | Gerado via transação isolada com status inicial 'Pendente'[cite: 3]. |

---

## ⚙️ Regras de Negócio e Engenharia de Software

### 1. Prevenção de Duplicidade (Garantia de Unicidade)
O campo `cpf` na tabela de clientes está configurado com a restrição relacional de unicidade (`UNIQUE`)[cite: 3]. No nível da aplicação (TypeScript/Angular), o serviço intercepta as tentativas de inserção duplicadas[cite: 3]. Caso ocorra uma violação de restrição, a camada de controle captura a falha, impede a corrupção da integridade relacional e retorna um alerta visual de aviso ao operador[cite: 3].

### 2. Módulo de Vendas Transacional e Gatilho Financeiro
No exato momento da gravação de uma venda, o sistema executa uma **transação atômica** que realiza as seguintes ações em lote:
* Valida se a quantidade solicitada está disponível em estoque.
* Registra a venda e vincula os itens correspondentes à transação.
* Deduz automaticamente a quantidade de produtos vendidos do estoque geral.
* Gera um registro financeiro associado na tabela `financeiro_receber` com o valor total da venda, data de vencimento padrão (ex: Data + 30 dias) e status como 'Pendente'.

### 3. Estratégia para Grandes Volumes (Escalabilidade Local)
Para evitar a degradação da performance à medida que a quantidade de usuários, clientes e produtos cresce de forma massiva, foram aplicados scripts de otimização através de índices de banco de dados específicos[cite: 3]:
```sql
CREATE INDEX idx_clientes_cpf ON clientes(cpf);
CREATE INDEX idx_vendas_data ON vendas(data_venda);
