import type { FilterMode } from '../types/orvc';

const FILTER_ROWS: { value: FilterMode; label: string }[][] = [
  [
    { value: 'main', label: 'Основной' },
    { value: 'all', label: 'Все' },
    { value: 'new', label: 'Новый' },
    { value: 'open', label: 'Открыт' },
    { value: 'confirmed', label: 'Подтвержден' },
    { value: 'nocall', label: 'Не дозвонились' },
    { value: 'changed', label: 'Заказ изменен' },
    { value: 'vsborke', label: 'В сборке' },
    { value: 'sobran', label: 'Собран' },
  ],
  [
    { value: 'otpravlen', label: 'Отправлен' },
    { value: 'dostavlen', label: 'Доставлен' },
    { value: 'complete', label: 'Завершен' },
    { value: 'canceled', label: 'Отменен' },
    { value: 'pending_payment', label: 'В ожидании опл.' },
    { value: 'pending_stock', label: 'В ожидании товаров' },
    { value: 'no_stock', label: 'Нет товаров' },
    { value: 'sorting', label: 'Отгружено' },
    { value: 'approved', label: 'Одобрен' },
  ],
];

interface Props {
  mode: FilterMode;
  ownOnly: boolean;
  onModeChange: (mode: FilterMode) => void;
  onOwnOnlyChange: (v: boolean) => void;
}

export default function FilterPanel({ mode, ownOnly, onModeChange, onOwnOnlyChange }: Props) {
  return (
    <div className="filter-panel">
      {FILTER_ROWS.map((row, ri) => (
        <div key={ri} className="filter-row">
          {row.map(item => (
            <label key={item.value} className={`filter-label${mode === item.value ? ' active' : ''}`}>
              <input
                type="radio"
                name="filterMode"
                value={item.value}
                checked={mode === item.value}
                onChange={() => onModeChange(item.value)}
              />
              <span>{item.label}</span>
            </label>
          ))}
          {ri === FILTER_ROWS.length - 1 && (
            <label className="filter-label filter-own">
              <input
                type="checkbox"
                checked={ownOnly}
                onChange={e => onOwnOnlyChange(e.target.checked)}
              />
              <span>Свои</span>
            </label>
          )}
        </div>
      ))}
    </div>
  );
}
