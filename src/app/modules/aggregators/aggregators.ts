import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgregateurService, Agregateur } from '../../core/services/agregateur.service';

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
    nompays: '',
    nomOperateur: ''
  });

  currentOperatorInput = signal('');

  get operatorsList(): string[] {
    const raw = (this.editingAggregator() || this.newAggregator()).nomOperateur;
    return raw ? raw.split(',').map(s => s.trim()).filter(s => s) : [];
  }

  addOperator(event?: Event) {
    if (event) event.preventDefault();
    const val = this.currentOperatorInput().trim();
    if (val) {
      const current = this.editingAggregator() || this.newAggregator();
      const list = this.operatorsList;
      if (!list.includes(val)) {
        list.push(val);
        current.nomOperateur = list.join(', ');
        this.currentOperatorInput.set('');
      }
    }
  }

  removeOperator(op: string) {
    const current = this.editingAggregator() || this.newAggregator();
    const list = this.operatorsList.filter(o => o !== op);
    current.nomOperateur = list.join(', ');
  }

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
    if (aggregator.nomA && aggregator.nompays && aggregator.nomOperateur) {
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
    this.editingAggregator.set({ ...agg });
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
      nompays: '',
      nomOperateur: ''
    });
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
}

