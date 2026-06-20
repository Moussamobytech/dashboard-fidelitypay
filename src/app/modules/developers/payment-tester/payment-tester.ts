import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DashboardPaymentTestResponse, PaymentInitiateRequest, PaymentStatus } from '../../../core/models/payment.model';
import { PaymentService } from '../../../core/services/payment.service';
import { MerchantProviderAccount, PaymentProviderService, PaymentRouteSetting } from '../../../core/services/payment-provider.service';
import { FpSelectComponent, FpSelectOption, FpSelectValue } from '../../../shared/fp-select/fp-select';

interface CountryChoice {
    code: string;
    label: string;
}

@Component({
    selector: 'app-payment-tester',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule, FpSelectComponent],
    templateUrl: './payment-tester.html',
    styleUrls: ['./payment-tester.scss']
})
export class PaymentTesterComponent implements OnInit {
    private paymentService = inject(PaymentService);
    private paymentProviderService = inject(PaymentProviderService);

    private readonly countryNames: Record<string, string> = {
        BJ: 'Bénin', BF: 'Burkina Faso', CI: 'Côte d’Ivoire', CM: 'Cameroun',
        INT: 'International', ML: 'Mali', NE: 'Niger', SN: 'Sénégal', TG: 'Togo'
    };
    private readonly dialCodes: Record<string, string> = {
        BJ: '229', BF: '226', CI: '225', CM: '237', ML: '223', NE: '227', SN: '221', TG: '228'
    };
    private routes: PaymentRouteSetting[] = [];
    private accounts: MerchantProviderAccount[] = [];

    form: PaymentInitiateRequest = {
        amount: 500,
        country: '',
        operator: '',
        phone: '',
        firstname: 'Test',
        lastname: 'Client',
        email: '',
        environment: 'sandbox',
        idempotencyKey: this.newIdempotencyKey(),
        returnUrl: '',
        cancelUrl: ''
    };

    environments = signal<string[]>([]);
    countries = signal<CountryChoice[]>([]);
    operators = signal<string[]>([]);
    environmentOptions = computed<FpSelectOption[]>(() => this.environments().map(environment => ({
        value: environment.toLowerCase(), label: environment === 'SANDBOX' ? 'Sandbox' : 'Live'
    })));
    countryOptions = computed<FpSelectOption[]>(() => this.countries().map(country => ({
        value: country.code, label: `${country.label} - ${country.code}`
    })));
    operatorOptions = computed<FpSelectOption[]>(() => this.operators().map(operator => ({ value: operator, label: operator })));
    isLoadingOptions = signal(false);
    isSubmitting = signal(false);
    errorMessage = signal<string | null>(null);
    result = signal<DashboardPaymentTestResponse | null>(null);

    ngOnInit(): void {
        this.loadAvailableCombinations();
    }

    loadAvailableCombinations(): void {
        this.isLoadingOptions.set(true);
        forkJoin({
            routes: this.paymentProviderService.getPaymentRoutes(false),
            accounts: this.paymentProviderService.getProviderAccounts()
        }).subscribe({
            next: ({ routes, accounts }) => {
                this.routes = (routes || []).filter(route => route.platformEnabled && route.effectiveEnabled);
                this.accounts = (accounts || []).filter(account => account.enabled);
                const environments = [...new Set(this.accounts
                    .filter(account => this.routes.some(route => this.accountCoversRoute(account, route)))
                    .map(account => account.environment.toUpperCase()))].sort((a, b) => a === 'SANDBOX' ? -1 : b === 'SANDBOX' ? 1 : a.localeCompare(b));
                this.environments.set(environments);
                this.form.environment = (environments[0]?.toLowerCase() || 'sandbox') as 'sandbox' | 'live';
                this.refreshCountries();
                this.errorMessage.set(environments.length
                    ? null
                    : 'Aucune combinaison de paiement n’est disponible. Activez un compte agrégateur couvrant au moins une route.');
                this.isLoadingOptions.set(false);
            },
            error: () => {
                this.environments.set([]);
                this.countries.set([]);
                this.operators.set([]);
                this.errorMessage.set('Impossible de charger les routes disponibles pour ce compte.');
                this.isLoadingOptions.set(false);
            }
        });
    }

    onEnvironmentChange(): void {
        this.refreshCountries();
        this.result.set(null);
    }

    onCountryChange(): void {
        this.form.phone = '';
        this.refreshOperators();
        this.result.set(null);
    }

    setEnvironment(value: FpSelectValue): void {
        this.form.environment = String(value) as 'sandbox' | 'live';
        this.onEnvironmentChange();
    }

    setCountry(value: FpSelectValue): void {
        this.form.country = String(value);
        this.onCountryChange();
    }

    setOperator(value: FpSelectValue): void {
        this.form.operator = String(value);
        this.result.set(null);
    }

    submit(): void {
        this.errorMessage.set(null);
        this.result.set(null);

        if (!this.form.amount || !this.form.country || !this.form.operator || (this.phoneRequired() && !this.form.phone)) {
            this.errorMessage.set(this.phoneRequired()
                ? 'Renseignez le montant, le pays, l’opérateur et le téléphone client.'
                : 'Renseignez le montant, le pays et le moyen de paiement.');
            return;
        }

        this.isSubmitting.set(true);
        const request: PaymentInitiateRequest = {
            ...this.form,
            amount: Number(this.form.amount),
            idempotencyKey: this.form.idempotencyKey?.trim() || this.newIdempotencyKey(),
            returnUrl: this.blankToUndefined(this.form.returnUrl),
            cancelUrl: this.blankToUndefined(this.form.cancelUrl),
            email: this.blankToUndefined(this.form.email)
        };
        this.form.idempotencyKey = request.idempotencyKey;

        this.paymentService.initiateDashboardTestPayment(request).subscribe({
            next: (response) => {
                this.result.set(response);
                this.isSubmitting.set(false);
            },
            error: (err) => {
                this.errorMessage.set(err.error?.message || err.error?.error || err.message || 'Impossible d’initier ce paiement test.');
                this.isSubmitting.set(false);
            }
        });
    }

    resetIdempotency(): void {
        this.form.idempotencyKey = this.newIdempotencyKey();
    }

    copy(value?: string): void {
        if (value) {
            navigator.clipboard.writeText(value);
        }
    }

    phonePlaceholder(): string {
        const dialCode = this.dialCodes[this.form.country];
        return dialCode ? `${dialCode}...` : 'Numéro au format international';
    }

    phoneRequired(): boolean {
        return this.form.country !== 'INT'
            && this.form.operator !== 'VISA'
            && this.form.operator !== 'MASTERCARD';
    }

    failureHelp(payment: DashboardPaymentTestResponse): string {
        const reason = payment.failureReason || '';
        if (reason === 'NO_PROVIDER_AVAILABLE_FOR_ENVIRONMENT') {
            return `Aucun compte agrégateur ${this.form.environment === 'sandbox' ? 'Sandbox' : 'Live'} actif ne couvre ce pays/opérateur. Ajoutez l’agrégateur correspondant dans Intégration & Clés.`;
        }
        if (reason === 'UNSUPPORTED_PAYIN_CAPABILITY') {
            return 'Aucune route FidelityPay ne couvre ce pays/opérateur. Vérifiez les routes couvertes de chaque agrégateur.';
        }
        if (reason === 'BAD_REQUEST') {
            return 'Le fournisseur a rejeté la requête. Vérifiez le numéro client, le montant, l’opérateur et les identifiants agrégateur.';
        }
        if (reason === 'AUTHENTICATION_FAILED') {
            const provider = payment.provider || 'Le fournisseur';
            const environment = this.form.environment === 'sandbox' ? 'Sandbox' : 'Live';
            return `${provider} a refusé les identifiants pour l’environnement ${environment}. Vérifiez que les clés proviennent du même environnement chez l’agrégateur.`;
        }
        if (reason === 'PROVIDER_RESULT_UNKNOWN') {
            return 'Le fournisseur a peut-être créé la transaction mais n’a pas retourné un résultat clair. Vérifiez ensuite le statut ou le webhook.';
        }
        if (payment.status === PaymentStatus.FAILED) {
            return 'Le test a échoué avant confirmation. Consultez l’erreur, la route choisie et les identifiants agrégateur.';
        }
        if (payment.status === PaymentStatus.PENDING) {
            return `${this.flowDescription(payment)} Le résultat final arrivera via le webhook marchand.`;
        }
        if (payment.status === PaymentStatus.REQUIRES_ACTION) {
            return 'Le fournisseur demande une action client, généralement un OTP ou une redirection.';
        }
        return 'Le test utilise la même orchestration que l’API marchand. Si ce résultat est correct, le câblage serveur utilisera le même comportement en Live.';
    }

    flowLabel(payment: DashboardPaymentTestResponse): string {
        switch (payment.flowType) {
            case 'HOSTED_CHECKOUT': return 'Page de paiement';
            case 'WAVE_REDIRECT': return 'Redirection Wave';
            case 'ORANGE_CI_OTP': return 'Validation par OTP';
            case 'MOBILE_MONEY_REQUEST': return 'Demande sur le téléphone';
            default: return payment.paymentUrl ? 'Redirection vers une page de paiement' : 'Confirmation fournisseur';
        }
    }

    flowDescription(payment: DashboardPaymentTestResponse): string {
        switch (payment.flowType) {
            case 'HOSTED_CHECKOUT':
                return 'Ouvrez la page de paiement et terminez le parcours chez le fournisseur.';
            case 'WAVE_REDIRECT':
                return 'Ouvrez le lien Wave pour autoriser le paiement.';
            case 'ORANGE_CI_OTP':
                return 'Le client doit fournir le code OTP demandé pour poursuivre.';
            case 'MOBILE_MONEY_REQUEST':
                return 'Une demande a été envoyée au téléphone du client; il doit la confirmer.';
            default:
                return payment.paymentUrl
                    ? 'Ouvrez la page de paiement pour poursuivre.'
                    : 'La demande est en attente de confirmation par le fournisseur.';
        }
    }

    private refreshCountries(): void {
        const environment = (this.form.environment || '').toUpperCase();
        const countryCodes = [...new Set(this.availableRoutes(environment).map(route => route.country))].sort();
        const countries = countryCodes.map(code => ({ code, label: this.countryNames[code] || code }));
        this.countries.set(countries);
        if (!countryCodes.includes(this.form.country)) {
            this.form.country = countryCodes[0] || '';
        }
        this.refreshOperators();
    }

    private refreshOperators(): void {
        const routes = this.availableRoutes((this.form.environment || '').toUpperCase())
            .filter(route => route.country === this.form.country);
        const operators = [...new Set(routes.map(route => route.operator))].sort();
        this.operators.set(operators);
        if (!operators.includes(this.form.operator)) {
            this.form.operator = operators[0] || '';
        }
    }

    private availableRoutes(environment: string): PaymentRouteSetting[] {
        return this.routes.filter(route =>
            (environment === 'SANDBOX' ? route.sandboxEnabled : route.liveEnabled) &&
            this.accounts.some(account => this.accountCoversRoute(account, route) &&
                account.environment.toUpperCase() === environment)
        );
    }

    private accountCoversRoute(account: MerchantProviderAccount, route: PaymentRouteSetting): boolean {
        return account.providerId === route.providerId;
    }

    private newIdempotencyKey(): string {
        return `dashboard-${Date.now()}`;
    }

    private blankToUndefined(value?: string): string | undefined {
        const trimmed = value?.trim();
        return trimmed ? trimmed : undefined;
    }
}
