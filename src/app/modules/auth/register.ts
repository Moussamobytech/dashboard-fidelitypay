import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterModule],
    templateUrl: './register.html',
    styleUrls: ['./register.scss']
})
export class RegisterComponent {
    private fb = inject(FormBuilder);
    private authService = inject(AuthService);
    private router = inject(Router);

    currentStep = signal(1);
    isLoading = signal(false);
    errorMessage = signal<string | null>(null);

    registerForm = this.fb.group({
        // Step 1
        firstName: ['', [Validators.required]],
        lastName: ['', [Validators.required]],
        appName: [''],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        // Step 2
        role: ['', [Validators.required]],
        country: ['', [Validators.required]]
    });

    roles = [
        { value: 'DEVELOPER', label: 'Développeur', icon: 'code' },
        { value: 'ENTREPRENEUR_CEO', label: 'Entrepreneur / CEO', icon: 'business' },
        { value: 'PRODUCT_MANAGER', label: 'Product Manager', icon: 'fact_check' },
        { value: 'AUTRE', label: 'Autre', icon: 'person' }
    ];

    countries = [
        { name: 'Sénégal', code: 'SN' },
        { name: 'Côte d\'Ivoire', code: 'CI' },
        { name: 'Mali', code: 'ML' },
        { name: 'Burkina Faso', code: 'BF' },
        { name: 'Bénin', code: 'BJ' },
        { name: 'Togo', code: 'TG' },
        { name: 'Cameroun', code: 'CM' }
    ];

    nextStep() {
        if (this.currentStep() === 1) {
            // Validate only step 1 fields
            const step1Fields = ['firstName', 'lastName', 'email', 'password'];
            let isValid = true;
            step1Fields.forEach(field => {
                const control = this.registerForm.get(field);
                if (control?.invalid) {
                    control.markAsTouched();
                    isValid = false;
                }
            });
            if (isValid) this.currentStep.set(2);
        }
    }

    prevStep() {
        this.currentStep.set(1);
    }

    onSubmit() {
        if (this.registerForm.valid) {
            this.isLoading.set(true);
            this.errorMessage.set(null);

            const formValue: any = this.registerForm.value;
            const role = formValue.role as string;
            const fullName = `${formValue.firstName} ${formValue.lastName}`.trim();

            this.authService.register({
                fullName: fullName,
                email: formValue.email!,
                password: formValue.password!,
                role: role,
                countries: formValue.country ? [formValue.country] : [], // Send as array for backend compatibility
                applicationName: formValue.appName
            }).subscribe({
                next: (response: any) => {
                    this.isLoading.set(false);
                    // Redirection based on role
                    if (role === 'DEVELOPER') {
                        this.router.navigate(['/developer-dashboard']);
                    } else if (role === 'ADMIN') {
                        this.router.navigate(['/dashboard']);
                    } else {
                        // CLIENT or others
                        this.router.navigate(['/dashboard']);
                    }
                },
                error: (err: any) => {
                    this.isLoading.set(false);
                    console.error('Registration error:', err);
                    this.errorMessage.set(err.error?.message || 'Une erreur est survenue lors de l\'inscription. Veuillez vérifier vos informations.');
                }
            });
        } else {
            this.registerForm.markAllAsTouched();
        }
    }
}
