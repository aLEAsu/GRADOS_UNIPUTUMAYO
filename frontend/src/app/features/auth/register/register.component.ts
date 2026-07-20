import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  firstName = '';
  lastName = '';
  email = '';
  phone = '';
  password = '';
  confirmPassword = '';
  studentCode = '';
  program = '';
  showPassword = signal(false);
  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  acceptPolicy = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit(): void {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (!this.firstName || !this.lastName || !this.email || !this.password || !this.studentCode || !this.program) {
      this.errorMessage.set('Por favor completa todos los campos obligatorios');
      return;
    }

    if (!this.acceptPolicy) {
      this.errorMessage.set('Debe aceptar la política de uso de datos para continuar');
      return;
    }

    if (this.password.length < 8) {
      this.errorMessage.set('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage.set('Las contraseñas no coinciden');
      return;
    }

    this.isLoading.set(true);

    this.authService.register({
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      password: this.password,
      phone: this.phone || undefined,
      studentCode: this.studentCode,
      program: this.program,
      acceptPolicy: this.acceptPolicy,
    }).subscribe({
      next: () => {
        this.successMessage.set('Cuenta creada exitosamente. Ahora puedes iniciar sesión.');
        setTimeout(() => this.router.navigate(['/auth/login']), 2500);
      },
      error: (error) => {
        this.isLoading.set(false);
        if (error.status === 409) {
          this.errorMessage.set('Ya existe una cuenta con este correo electrónico');
        } else if (error.error?.message) {
          this.errorMessage.set(error.error.message);
        } else {
          this.errorMessage.set('Ocurrió un error al crear la cuenta. Intenta de nuevo.');
        }
      }
    });
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  loginWithGoogle(): void {
    this.authService.googleLogin();
  }
}
