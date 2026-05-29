import { Component, OnInit } from '@angular/core';
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
  IonCard, 
  IonCardHeader, 
  IonCardTitle, 
  IonCardContent, 
  IonItem, 
  IonInput, 
  IonButton, 
  IonIcon, 
  IonToast,
  AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personAdd, people, cube, save, alertCircle } from 'ionicons/icons';
import { AuthService } from '../services/auth.service';
import { ClientService } from '../services/client.service';
import { ProductService } from '../services/product.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
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
    IonCard, 
    IonCardHeader, 
    IonCardTitle, 
    IonCardContent, 
    IonItem, 
    IonInput, 
    IonButton, 
    IonIcon, 
    IonToast
  ]
})
export class Tab1Page implements OnInit {
  currentSegment = 'cliente'; // Default segment

  // Form states
  userForm = { nome: '', login: '', senha: '' };
  clientForm = { nome: '', cpf: '', email: '', telefone: '' };
  productForm = { nome: '', preco_venda: 0, quantidade_estoque: 0 };

  toastMessage = '';
  isToastOpen = false;

  constructor(
    private authService: AuthService,
    private clientService: ClientService,
    private productService: ProductService,
    private alertController: AlertController,
    private router: Router
  ) {
    addIcons({ personAdd, people, cube, save, alertCircle });
  }

  goToLogin() {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }

  ngOnInit() {
    // Initialization
  }

  // ==========================================
  // CPF MASKING & VALIDATION
  // ==========================================
  onCPFInput(event: any) {
    let val = event.target.value || '';
    // Format value
    const formatted = this.formatCPF(val);
    this.clientForm.cpf = formatted;
    // Reflect back in input component value
    event.target.value = formatted;
  }

  formatCPF(value: string): string {
    const nums = value.replace(/\D/g, '').substring(0, 11);
    if (nums.length <= 3) return nums;
    if (nums.length <= 6) return `${nums.substring(0, 3)}.${nums.substring(3)}`;
    if (nums.length <= 9) return `${nums.substring(0, 3)}.${nums.substring(3, 6)}.${nums.substring(6)}`;
    return `${nums.substring(0, 3)}.${nums.substring(3, 6)}.${nums.substring(6, 9)}-${nums.substring(9)}`;
  }

  isCPFValid(cpf: string): boolean {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) return false;
    
    // Check for known invalid CPFs
    if (/^(\d)\1{10}$/.test(cleanCpf)) return false;

    // Validate check digits
    let sum = 0;
    let remainder;
    for (let i = 1; i <= 9; i++) {
      sum += parseInt(cleanCpf.substring(i - 1, i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCpf.substring(9, 10))) return false;

    sum = 0;
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(cleanCpf.substring(i - 1, i)) * (12 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCpf.substring(10, 11))) return false;

    return true;
  }

  // ==========================================
  // SUBMISSIONS
  // ==========================================
  async saveUser() {
    if (!this.userForm.nome || !this.userForm.login || !this.userForm.senha) {
      this.showToast('Preencha todos os campos do usuário.');
      return;
    }

    try {
      await this.authService.registerUser(this.userForm.nome, this.userForm.login, this.userForm.senha);
      this.showToast('Usuário cadastrado com sucesso!');
      this.resetUserForm();
    } catch (err: any) {
      this.showToast(err.message || 'Erro ao cadastrar usuário.');
    }
  }

  async saveClient() {
    if (!this.clientForm.nome || !this.clientForm.cpf) {
      this.showToast('Nome e CPF são campos obrigatórios.');
      return;
    }

    if (!this.isCPFValid(this.clientForm.cpf)) {
      const alert = await this.alertController.create({
        header: 'CPF Inválido',
        message: 'O CPF informado não é válido. Por favor, verifique os dígitos.',
        buttons: ['Entendido'],
        cssClass: 'green-alert'
      });
      await alert.present();
      return;
    }

    try {
      await this.clientService.createClient({
        nome: this.clientForm.nome,
        cpf: this.clientForm.cpf,
        email: this.clientForm.email,
        telefone: this.clientForm.telefone
      });
      this.showToast('Cliente cadastrado com sucesso!');
      this.resetClientForm();
    } catch (err: any) {
      if (err.message === 'CLIENTE_JA_CADASTRADO') {
        const alert = await this.alertController.create({
          header: 'Cliente já cadastrado',
          subHeader: 'CPF Duplicado',
          message: `O cliente com o CPF "${this.clientForm.cpf}" já consta em nossa base de dados.`,
          buttons: ['Entendido'],
          cssClass: 'green-alert'
        });
        await alert.present();
      } else {
        this.showToast('Erro ao cadastrar cliente.');
      }
    }
  }

  async saveProduct() {
    if (!this.productForm.nome || this.productForm.preco_venda <= 0) {
      this.showToast('Insira um nome e preço válido para o produto.');
      return;
    }

    try {
      await this.productService.createProduct({
        nome: this.productForm.nome,
        preco_venda: this.productForm.preco_venda,
        quantidade_estoque: this.productForm.quantidade_estoque
      });
      this.showToast('Produto cadastrado com sucesso!');
      this.resetProductForm();
    } catch (err: any) {
      this.showToast('Erro ao cadastrar produto.');
    }
  }

  // ==========================================
  // RESET ACTIONS
  // ==========================================
  resetUserForm() {
    this.userForm = { nome: '', login: '', senha: '' };
  }

  resetClientForm() {
    this.clientForm = { nome: '', cpf: '', email: '', telefone: '' };
  }

  resetProductForm() {
    this.productForm = { nome: '', preco_venda: 0, quantidade_estoque: 0 };
  }

  // ==========================================
  // UTILS
  // ==========================================
  showToast(msg: string) {
    this.toastMessage = msg;
    this.isToastOpen = true;
  }

  setToastOpen(isOpen: boolean) {
    this.isToastOpen = isOpen;
  }
}
