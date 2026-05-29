import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonButton, 
  IonIcon, 
  IonBadge, 
  IonCard, 
  IonCardHeader, 
  IonCardTitle, 
  IonToast,
  AlertController,
  IonButtons
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { documentText, chevronDown, chevronUp, cash, time, people, cube, trash, print } from 'ionicons/icons';
import { SalesService } from '../services/sales.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonContent, 
    IonButton, 
    IonIcon, 
    IonBadge, 
    IonCard, 
    IonCardHeader, 
    IonCardTitle, 
    IonToast,
    IonButtons
  ]
})
export class Tab3Page {
  salesReport: any[] = [];
  canceledSales: any[] = [];
  expandedSaleId: number | null = null;

  toastMessage = '';
  isToastOpen = false;

  constructor(
    private salesService: SalesService,
    private alertController: AlertController,
    private authService: AuthService,
    private router: Router
  ) {
    addIcons({ documentText, chevronDown, chevronUp, cash, time, people, cube, trash, print });
  }

  onPrintReport() {
    window.print();
  }

  goToLogin() {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }

  async ionViewWillEnter() {
    await this.loadReports();
  }

  async loadReports() {
    try {
      this.salesReport = await this.salesService.getSalesReport();
      this.canceledSales = await this.salesService.getCanceledSales();
    } catch (err) {
      this.showToast('Erro ao carregar relatório de vendas.');
    }
  }

  // ==========================================
  // LAZY LOADING ITEMS DETAILS
  // ==========================================
  async toggleExpand(sale: any) {
    if (this.expandedSaleId === sale.id) {
      this.expandedSaleId = null;
    } else {
      this.expandedSaleId = sale.id;
      // Lazy load items details if not already loaded
      if (!sale.items) {
        try {
          sale.items = await this.salesService.getSaleItems(sale.id);
        } catch (err) {
          this.showToast('Erro ao carregar itens da venda.');
        }
      }
    }
  }

  // ==========================================
  // BILL PAYMENT ACTION
  // ==========================================
  async onPayBill(event: Event, sale: any) {
    event.stopPropagation(); // Avoid triggering details toggle

    const alert = await this.alertController.create({
      header: 'Liquidar Conta',
      message: `Deseja marcar o faturamento da Venda #${sale.id} no valor de R$ ${sale.valor_total.toFixed(2)} como PAGO?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Confirmar Pagamento',
          handler: async () => {
            await this.processPayment(sale.id);
          }
        }
      ],
      cssClass: 'green-alert'
    });

    await alert.present();
  }

  private async processPayment(vendaId: number) {
    try {
      await this.salesService.payBill(vendaId);
      this.showToast('Pagamento confirmado com sucesso!');
      await this.loadReports(); // Refresh report
      if (this.expandedSaleId === vendaId) {
        this.expandedSaleId = null; // Collapse if active
      }
    } catch (err) {
      this.showToast('Erro ao registrar pagamento.');
    }
  }

  // ==========================================
  // SALE CANCELLATION ACTION
  // ==========================================
  async onCancelSale(event: Event, sale: any) {
    event.stopPropagation(); // Avoid triggering details toggle

    const alert = await this.alertController.create({
      header: 'Cancelar Venda',
      message: `Deseja cancelar a Venda #${sale.id}? Esta ação devolverá os itens ao estoque e removerá a venda ativa.`,
      inputs: [
        {
          name: 'justificativa',
          type: 'textarea',
          placeholder: 'Digite a justificativa do cancelamento (mínimo 5 caracteres)...'
        }
      ],
      buttons: [
        {
          text: 'Voltar',
          role: 'cancel'
        },
        {
          text: 'Confirmar Cancelamento',
          handler: async (data) => {
            const justificativa = data.justificativa?.trim();
            if (!justificativa || justificativa.length < 5) {
              this.showToast('Por favor, informe uma justificativa válida (mínimo 5 caracteres).');
              return false; // Prevent closing the dialog
            }
            await this.processCancellation(sale.id, justificativa);
            return true;
          }
        }
      ],
      cssClass: 'green-alert'
    });

    await alert.present();
  }

  private async processCancellation(vendaId: number, justificativa: string) {
    try {
      await this.salesService.cancelSale(vendaId, justificativa);
      this.showToast('Venda cancelada com sucesso!');
      await this.loadReports(); // Refresh report
      if (this.expandedSaleId === vendaId) {
        this.expandedSaleId = null; // Collapse if active
      }
    } catch (err) {
      this.showToast('Erro ao cancelar a venda.');
    }
  }

  showToast(msg: string) {
    this.toastMessage = msg;
    this.isToastOpen = true;
  }

  setToastOpen(isOpen: boolean) {
    this.isToastOpen = isOpen;
  }
}
