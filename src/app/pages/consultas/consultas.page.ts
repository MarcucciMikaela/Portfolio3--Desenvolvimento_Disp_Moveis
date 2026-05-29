import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonSegment, 
  IonSegmentButton, 
  IonLabel, 
  IonIcon, 
  IonBadge, 
  IonSearchbar, 
  IonToast,
  IonButton,
  AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { people, cube, person, search, create, trash } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { ClientService } from '../../services/client.service';
import { ProductService } from '../../services/product.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-consultas',
  templateUrl: './consultas.page.html',
  styleUrls: ['./consultas.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonContent, 
    IonSegment, 
    IonSegmentButton, 
    IonLabel, 
    IonIcon, 
    IonBadge, 
    IonSearchbar, 
    IonToast,
    IonButton
  ]
})
export class ConsultasPage {
  currentSegment = 'produto'; // default segment (1. Produtos 2. Clientes 3. Usuários)
  searchTerm = '';

  users: any[] = [];
  clients: any[] = [];
  products: any[] = [];

  filteredUsers: any[] = [];
  filteredClients: any[] = [];
  filteredProducts: any[] = [];

  toastMessage = '';
  isToastOpen = false;

  constructor(
    private authService: AuthService,
    private clientService: ClientService,
    private productService: ProductService,
    private alertController: AlertController,
    private router: Router
  ) {
    addIcons({ people, cube, person, search, create, trash });
  }

  goToLogin() {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }

  async ionViewWillEnter() {
    this.searchTerm = '';
    await this.loadData();
  }

  async loadData() {
    try {
      this.users = await this.authService.getUsers();
      this.clients = await this.clientService.getClients();
      this.products = await this.productService.getProducts();
      this.filter();
    } catch (err) {
      this.showToast('Erro ao carregar os dados de consulta.');
    }
  }

  onSegmentChange() {
    this.searchTerm = '';
    this.filter();
  }

  onSearch(event: any) {
    this.searchTerm = event.target.value || '';
    this.filter();
  }

  filter() {
    const query = this.searchTerm.trim().toLowerCase();

    if (this.currentSegment === 'usuario') {
      if (!query) {
        this.filteredUsers = [...this.users];
      } else {
        this.filteredUsers = this.users.filter(u => 
          u.nome.toLowerCase().includes(query) || 
          u.login.toLowerCase().includes(query)
        );
      }
    } else if (this.currentSegment === 'cliente') {
      if (!query) {
        this.filteredClients = [...this.clients];
      } else {
        this.filteredClients = this.clients.filter(c => 
          c.nome.toLowerCase().includes(query) || 
          c.cpf.includes(query) || 
          (c.email && c.email.toLowerCase().includes(query)) ||
          (c.telefone && c.telefone.includes(query))
        );
      }
    } else if (this.currentSegment === 'produto') {
      if (!query) {
        this.filteredProducts = [...this.products];
      } else {
        this.filteredProducts = this.products.filter(p => 
          p.nome.toLowerCase().includes(query)
        );
      }
    }
  }

  // ==========================================
  // CLIENT ACTIONS
  // ==========================================
  async onEditClient(event: Event, client: any) {
    event.stopPropagation();

    const alert = await this.alertController.create({
      header: 'Editar Cliente',
      inputs: [
        {
          name: 'nome',
          type: 'text',
          value: client.nome,
          placeholder: 'Nome Completo'
        },
        {
          name: 'email',
          type: 'email',
          value: client.email,
          placeholder: 'E-mail'
        },
        {
          name: 'telefone',
          type: 'tel',
          value: client.telefone,
          placeholder: 'Telefone'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Salvar',
          handler: async (data) => {
            const nome = data.nome?.trim();
            if (!nome) {
              this.showToast('O nome é obrigatório.');
              return false;
            }
            try {
              await this.clientService.updateClient({
                id: client.id,
                nome,
                cpf: client.cpf,
                email: data.email?.trim() || '',
                telefone: data.telefone?.trim() || ''
              });
              this.showToast('Cliente atualizado com sucesso!');
              await this.loadData();
              return true;
            } catch (err: any) {
              this.showToast('Erro ao atualizar cliente.');
              return false;
            }
          }
        }
      ],
      cssClass: 'green-alert'
    });

    await alert.present();
  }

  // ==========================================
  // USER ACTIONS
  // ==========================================
  async onEditUser(event: Event, user: any) {
    event.stopPropagation();

    const alert = await this.alertController.create({
      header: 'Editar Usuário',
      inputs: [
        {
          name: 'nome',
          type: 'text',
          value: user.nome,
          placeholder: 'Nome Completo'
        },
        {
          name: 'login',
          type: 'text',
          value: user.login,
          placeholder: 'Login de acesso'
        },
        {
          name: 'senha',
          type: 'password',
          placeholder: 'Nova senha (deixe em branco para manter)'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Salvar',
          handler: async (data) => {
            const nome = data.nome?.trim();
            const login = data.login?.trim();
            if (!nome || !login) {
              this.showToast('Nome e Login são obrigatórios.');
              return false;
            }
            try {
              await this.authService.updateUser(user.id, nome, login, data.senha?.trim());
              this.showToast('Usuário atualizado com sucesso!');
              await this.loadData();
              return true;
            } catch (err: any) {
              this.showToast(err.message || 'Erro ao atualizar usuário.');
              return false;
            }
          }
        }
      ],
      cssClass: 'green-alert'
    });

    await alert.present();
  }

  async onDeleteUser(event: Event, user: any) {
    event.stopPropagation();

    if (user.id === 1) {
      this.showToast('O usuário Administrador principal não pode ser excluído.');
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    if (currentUser && currentUser.id === user.id) {
      this.showToast('Você não pode excluir o usuário que está logado atualmente.');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Excluir Usuário',
      message: `Deseja realmente excluir o usuário "${user.nome}"?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Confirmar Exclusão',
          handler: async () => {
            try {
              await this.authService.deleteUser(user.id);
              this.showToast('Usuário excluído com sucesso!');
              await this.loadData();
            } catch (err) {
              this.showToast('Erro ao excluir usuário.');
            }
          }
        }
      ],
      cssClass: 'green-alert'
    });

    await alert.present();
  }

  showToast(msg: string) {
    this.toastMessage = msg;
    this.isToastOpen = true;
  }

  setToastOpen(isOpen: boolean) {
    this.isToastOpen = isOpen;
  }
}
