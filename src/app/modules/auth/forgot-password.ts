import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-forgot-password',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterModule],
    templateUrl: './forgot-password.html',
    styleUrls: ['./register.scss']
})
export class ForgotPasswordComponent {
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private authService = inject(AuthService);

    isLoading = signal(false);
    isSuccess = signal(false);
    errorMessage = signal<string | null>(null);

    forgotForm = this.fb.group({
        email: ['', [Validators.required, Validators.email]]
    });

    onSubmit() {
        if (this.forgotForm.valid) {
            this.isLoading.set(true);
            this.errorMessage.set(null);

            const email = this.forgotForm.value.email!;

            this.authService.forgotPassword(email).subscribe({
                next: () => {
                    this.isLoading.set(false);
                    this.isSuccess.set(true);
                },
                error: (err) => {
                    this.isLoading.set(false);
                    this.errorMessage.set(err.error?.message || 'Une erreur est survenue lors de la demande de réinitialisation.');
                }
            });
        } else {
            this.forgotForm.markAllAsTouched();
        }
    }

    backToLogin() {
        this.router.navigate(['/login']);
    }
}
