import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, 
  IonCard, 
  IonCardHeader, 
  IonCardTitle, 
  IonCardSubtitle, 
  IonCardContent, 
  IonItem, 
  IonInput, 
  IonButton, 
  IonIcon,
  IonToast,
  AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { lockClosed, person, logIn, personAdd } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    IonContent, 
    IonCard, 
    IonCardHeader, 
    IonCardTitle, 
    IonCardSubtitle, 
    IonCardContent, 
    IonItem, 
    IonInput, 
    IonButton, 
    IonIcon,
    IonToast
  ]
})
export class LoginPage {
  loginData = {
    username: '',
    password: ''
  };

  toastMessage = '';
  isToastOpen = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private alertController: AlertController
  ) {
    addIcons({ lockClosed, person, logIn, personAdd });
  }

  async onLogin() {
    if (!this.loginData.username || !this.loginData.password) {
      this.showToast('Por favor, preencha todos os campos.');
      return;
    }

    const success = await this.authService.login(
      this.loginData.username.trim(),
      this.loginData.password.trim()
    );

    if (success) {
      this.showToast('Login efetuado com sucesso!');
      this.router.navigateByUrl('/tabs/vendas');
    } else {
      this.showToast('Login ou senha incorretos.');
    }
  }

  async onCreateUser() {
    const alert = await this.alertController.create({
      header: 'Novo Usuário',
      subHeader: 'Cadastro de acesso ao sistema',
      inputs: [
        {
          name: 'nome',
          type: 'text',
          placeholder: 'Nome Completo'
        },
        {
          name: 'login',
          type: 'text',
          placeholder: 'Nome de usuário (Login)'
        },
        {
          name: 'senha',
          type: 'password',
          placeholder: 'Senha de Acesso'
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
            if (!data.nome || !data.login || !data.senha) {
              this.showToast('Todos os campos são obrigatórios.');
              return false;
            }
            try {
              await this.authService.registerUser(data.nome, data.login, data.senha);
              this.showToast('Usuário cadastrado com sucesso! Faça login.');
              return true;
            } catch (err: any) {
              this.showToast(err.message || 'Erro ao cadastrar usuário.');
              return false;
            }
          }
        }
      ]
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
