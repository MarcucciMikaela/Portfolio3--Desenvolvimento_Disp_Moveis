import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonItem, 
  IonLabel, 
  IonSelect, 
  IonSelectOption, 
  IonButton, 
  IonIcon, 
  IonList, 
  IonCard, 
  IonCardHeader, 
  IonCardTitle, 
  IonCardContent, 
  IonToast, 
  IonBadge,
  IonInput,
  AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cart, trash, add, remove, checkmarkCircle, people, cube, cash } from 'ionicons/icons';
import { ClientService, Cliente } from '../services/client.service';
import { ProductService, Produto } from '../services/product.service';
import { SalesService } from '../services/sales.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

interface CartItem {
  produto: Produto;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonContent, 
    IonItem, 
    IonLabel, 
    IonSelect, 
    IonSelectOption, 
    IonButton, 
    IonIcon, 
    IonList, 
    IonCard, 
    IonCardHeader, 
    IonCardTitle, 
    IonCardContent, 
    IonToast, 
    IonBadge,
    IonInput
  ]
})
export class Tab2Page {
  clients: Cliente[] = [];
  products: Produto[] = [];
  
  selectedClientId: number | null = null;
  selectedProductId: number | null = null;
  selectedQuantity: number = 1;

  cartItems: CartItem[] = [];
  totalValue: number = 0;

  toastMessage = '';
  isToastOpen = false;

  constructor(
    private clientService: ClientService,
    private productService: ProductService,
    private salesService: SalesService,
    private alertController: AlertController,
    private authService: AuthService,
    private router: Router
  ) {
    addIcons({ cart, trash, add, remove, checkmarkCircle, people, cube, cash });
  }

  goToLogin() {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }

  // Refresh lists every time the user enters the screen
  async ionViewWillEnter() {
    await this.loadClientsAndProducts();
  }

  async loadClientsAndProducts() {
    try {
      this.clients = await this.clientService.getClients();
      this.products = await this.productService.getProducts();
    } catch (err) {
      this.showToast('Erro ao carregar dados do banco local.');
    }
  }

  // ==========================================
  // CART ACTIONS
  // ==========================================
  addToCart() {
    if (!this.selectedProductId) {
      this.showToast('Por favor, selecione um produto.');
      return;
    }

    const prod = this.products.find(p => p.id === this.selectedProductId);
    if (!prod) return;

    // Coerce selectedQuantity explicitly to number
    const qty = Number(this.selectedQuantity);

    if (isNaN(qty) || qty <= 0) {
      this.showToast('Quantidade inválida.');
      return;
    }

    // Live stock verification before adding to cart
    const existingCartItem = this.cartItems.find(item => item.produto.id === prod.id);
    const currentQtyInCart = existingCartItem ? Number(existingCartItem.quantidade) : 0;
    const totalRequested = currentQtyInCart + qty;

    if (prod.quantidade_estoque < totalRequested) {
      this.showToast(`Estoque insuficiente! Apenas ${prod.quantidade_estoque} unidades em estoque.`);
      return;
    }

    if (existingCartItem) {
      existingCartItem.quantidade = totalRequested;
      existingCartItem.subtotal = existingCartItem.quantidade * existingCartItem.preco_unitario;
    } else {
      this.cartItems.push({
        produto: prod,
        quantidade: qty,
        preco_unitario: prod.preco_venda,
        subtotal: qty * prod.preco_venda
      });
    }

    this.calculateTotal();
    this.selectedProductId = null;
    this.selectedQuantity = 1;
    this.showToast('Produto adicionado ao carrinho.');
  }

  removeFromCart(index: number) {
    this.cartItems.splice(index, 1);
    this.calculateTotal();
    this.showToast('Produto removido do carrinho.');
  }

  increaseQuantity(index: number) {
    const item = this.cartItems[index];
    if (item.produto.quantidade_estoque < item.quantidade + 1) {
      this.showToast(`Estoque limite atingido para "${item.produto.nome}".`);
      return;
    }
    item.quantidade++;
    item.subtotal = item.quantidade * item.preco_unitario;
    this.calculateTotal();
  }

  decreaseQuantity(index: number) {
    const item = this.cartItems[index];
    if (item.quantidade <= 1) {
      this.removeFromCart(index);
      return;
    }
    item.quantidade--;
    item.subtotal = item.quantidade * item.preco_unitario;
    this.calculateTotal();
  }

  calculateTotal() {
    this.totalValue = this.cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  }

  // ==========================================
  // CHECKOUT TRANSACTION
  // ==========================================
  async onCheckout() {
    if (!this.selectedClientId) {
      this.showToast('Por favor, selecione o cliente.');
      return;
    }

    if (this.cartItems.length === 0) {
      this.showToast('Adicione pelo menos um produto ao carrinho.');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Confirmar Venda',
      message: `Deseja efetivar esta venda no valor total de R$ ${this.totalValue.toFixed(2)}?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Confirmar',
          handler: async () => {
            await this.processCheckout();
          }
        }
      ],
      cssClass: 'green-alert'
    });

    await alert.present();
  }

  private async processCheckout() {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      
      const vendaInput = {
        cliente_id: this.selectedClientId!,
        data_venda: todayStr,
        valor_total: this.totalValue,
        itens: this.cartItems.map(item => ({
          produto_id: item.produto.id!,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario
        }))
      };

      await this.salesService.checkout(vendaInput);
      
      // Complete checkout workflow
      const successAlert = await this.alertController.create({
        header: 'Venda Concluída!',
        message: 'A venda foi realizada e a conta a receber foi gerada como Pendente.',
        buttons: ['Ok'],
        cssClass: 'green-alert'
      });
      await successAlert.present();

      this.clearCart();
      await this.loadClientsAndProducts(); // Reload stock
    } catch (err: any) {
      const errAlert = await this.alertController.create({
        header: 'Erro na Transação',
        message: err.message || 'Houve um erro ao efetuar a venda.',
        buttons: ['Fechar']
      });
      await errAlert.present();
    }
  }

  clearCart() {
    this.cartItems = [];
    this.totalValue = 0;
    this.selectedClientId = null;
  }

  showToast(msg: string) {
    this.toastMessage = msg;
    this.isToastOpen = true;
  }

  setToastOpen(isOpen: boolean) {
    this.isToastOpen = isOpen;
  }
}
