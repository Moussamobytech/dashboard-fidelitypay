import { Component, signal, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgregateurService, Agregateur, CountryConfig } from '../../core/services/agregateur.service';

@Component({
  selector: 'app-aggregators',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './aggregators.html',
  styleUrls: ['./aggregators.scss']
})
export class AggregatorsComponent implements OnInit {
  private agregateurService = inject(AgregateurService);

  viewMode = signal<'list' | 'grid'>('list');
  aggregators = signal<Agregateur[]>([]);
  isLoading = signal(false);

  showAddForm = signal(false);
  
  // Editing state
  editingAggregator = signal<Agregateur | null>(null);
  viewingAggregator = signal<Agregateur | null>(null);

  // Form fields
  newAggregator = signal<Agregateur>({
    nomA: '',
    cleApblic: '',
    cleApr: '',
    cleAtoken: '',
    countryConfigs: []
  });

  currentOperatorInput = signal('');
  
  // Country Search/Selection state
  countrySearchQuery = signal('');
  showCountryDropdown = signal(false);

  // Available countries for selection
  availableCountries = [
    'Bénin',
    'Burkina Faso',
    'Cameroun',
    'Côte d\'Ivoire',
    'Guinée',
    'Mali',
    'Sénégal',
    'Togo'
  ];

  filteredCountries = computed(() => {
    const query = this.countrySearchQuery().toLowerCase();
    return this.availableCountries.filter(c => c.toLowerCase().includes(query));
  });

  toggleCountryDropdown() {
    this.showCountryDropdown.update(v => !v);
  }

  onSearchBlur() {
    // Delay hiding to allow click event on options to fire
    setTimeout(() => this.showCountryDropdown.set(false), 200);
  }

  selectCountry(country: string) {
    this.addCountryToConfig(country);
    this.countrySearchQuery.set('');
    this.showCountryDropdown.set(false);
  }

  // Logic to add a country to the aggregator's config
  addCountryToConfig(country: string) {
    const current = this.editingAggregator() || this.newAggregator();
    if (!current.countryConfigs) {
      current.countryConfigs = [];
    }
    if (!current.countryConfigs.some(c => c.countryName === country)) {
      current.countryConfigs.push({
        countryName: country,
        operators: ''
      });
    }
  }

  onCountrySelect(event: Event) {
    const select = event.target as HTMLSelectElement;
    const country = select.value;
    if (country) {
      this.addCountryToConfig(country);
      select.value = '';
    }
  }

  removeCountryFromConfig(country: string) {
    const current = this.editingAggregator() || this.newAggregator();
    if (current.countryConfigs) {
      current.countryConfigs = current.countryConfigs.filter(c => c.countryName !== country);
    }
  }

  // Operator logic per country
  addOperatorToCountry(config: CountryConfig, event?: Event) {
    if (event) event.preventDefault();
    const val = this.currentOperatorInput().trim();
    if (val) {
      const ops = this.getOperatorsList(config.operators);
      if (!ops.includes(val)) {
        ops.push(val);
        config.operators = ops.join(', ');
        this.currentOperatorInput.set('');
      }
    }
  }

  removeOperatorFromCountry(config: CountryConfig, op: string) {
    const ops = this.getOperatorsList(config.operators).filter(o => o !== op);
    config.operators = ops.join(', ');
  }

  getOperatorsList(operators: string): string[] {
    return operators ? operators.split(',').map((s: string) => s.trim()).filter((s: string) => s) : [];
  }

  selectedCountries = computed(() => {
    const current = this.editingAggregator() || this.newAggregator();
    return current.countryConfigs ? current.countryConfigs.map(c => c.countryName) : [];
  });

  ngOnInit() {
    this.loadAggregators();
  }

  loadAggregators() {
    this.isLoading.set(true);
    this.agregateurService.getAllAgregateurs().subscribe({
      next: (data) => {
        this.aggregators.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Erreur lors du chargement des agrégateurs', err);
        this.isLoading.set(false);
      }
    });
  }

  toggleAddForm() {
    if (this.showAddForm()) {
      this.showAddForm.set(false);
      this.resetForm();
    } else {
      this.showAddForm.set(true);
    }
  }

  addAggregator() {
    const aggregator = this.newAggregator();
    if (aggregator.nomA && aggregator.countryConfigs && aggregator.countryConfigs.length > 0) {
      this.agregateurService.createAgregateur(aggregator).subscribe({
        next: (created) => {
          this.aggregators.update(list => [...list, created]);
          this.resetForm();
          this.showAddForm.set(false);
        },
        error: (err) => {
          console.error('Erreur lors de la création de l\'agrégateur', err);
          alert('Erreur lors de la création');
        }
      });
    }
  }

  startEdit(agg: Agregateur, index: number) {
    // Deep copy to avoid direct mutation before save
    const copy = JSON.parse(JSON.stringify(agg));
    if (!copy.countryConfigs) {
      copy.countryConfigs = [];
    }
    this.editingAggregator.set(copy);
  }

  cancelEdit() {
    this.editingAggregator.set(null);
  }

  saveEdit() {
    const edited = this.editingAggregator();
    if (edited && edited.id) {
      this.agregateurService.updateAgregateur(edited.id, edited).subscribe({
        next: (updated) => {
          this.aggregators.update(list => list.map(a => a.id === updated.id ? updated : a));
          this.cancelEdit();
        },
        error: (err) => {
          console.error('Erreur lors de la mise à jour de l\'agrégateur', err);
          alert('Erreur lors de la mise à jour');
        }
      });
    }
  }

  resetForm() {
    this.newAggregator.set({
      nomA: '',
      cleApblic: '',
      cleApr: '',
      cleAtoken: '',
      countryConfigs: []
    });
    this.currentOperatorInput.set('');
  }

  deleteAggregator(index: number) {
    const agg = this.aggregators()[index];
    if (agg && agg.id && confirm('Voulez-vous vraiment supprimer cet agrégateur ?')) {
      this.agregateurService.deleteAgregateur(agg.id).subscribe({
        next: () => {
          this.aggregators.update(list => list.filter(a => a.id !== agg.id));
        },
        error: (err) => {
          console.error('Erreur lors de la suppression de l\'agrégateur', err);
          alert('Erreur lors de la suppression');
        }
      });
    }
  }

  getOperatorIcon(operator: string): string {
    const op = operator?.toUpperCase() || '';
    if (op.includes('ORANGE')) return 'phone_android';
    if (op.includes('MTN')) return 'cell_tower';
    if (op.includes('MOOV')) return 'tap_and_play';
    if (op.includes('WAVE')) return 'waves';
    if (op.includes('PAYPAL')) return 'payment';
    if (op.includes('STRIPE')) return 'credit_card';
    return 'account_balance_wallet';
  }

  getTotalOperators(agg: Agregateur): number {
    if (!agg.countryConfigs) return 0;
    return agg.countryConfigs.reduce((acc, config) => acc + this.getOperatorsList(config.operators).length, 0);
  }
}
