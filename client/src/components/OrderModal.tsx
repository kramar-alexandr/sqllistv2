import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOrderDetail } from '../api/orvc';

interface Props {
  sernr: number | null;
  compno: string | number;
  onClose: () => void;
}

function Field({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="modal-field">
      <span className="modal-field-label">{label}:</span>
      <span className="modal-field-value">{String(value)}</span>
    </div>
  );
}

export default function OrderModal({ sernr, compno, onClose }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['orvc', 'order', sernr, compno],
    queryFn: () => fetchOrderDetail(sernr!, compno),
    enabled: sernr !== null,
    staleTime: 10_000,
  });

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (sernr === null) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span>Заказ № {sernr}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {isLoading ? (
            <div className="modal-loading">Загрузка...</div>
          ) : data?.order ? (
            <>
              <div className="modal-section-title">Основное</div>
              <Field label="Серийный №" value={data.order.SERNR as string} />
              <Field label="Клиент" value={data.order.CUSTCODE as string} />
              <Field label="Имя" value={data.order.ADDR0 as string} />
              <Field label="Дата" value={data.order.ORDDATE as string} />
              <Field label="Сумма" value={data.order.SUM4 as number} />
              <Field label="Статус" value={data.order.CUSTOMSTATUSFLAGTEXT as string} />
              <Field label="Телефон" value={data.order.PHONE as string} />
              <Field label="Nova Poshta тел." value={data.order.NPPHONE as string} />
              <Field label="Комментарий" value={data.order.rdbCOMMENT as string} />
              <Field label="Комментарий 2" value={data.order.COMMENT2 as string} />
              <Field label="Комментарий 3" value={data.order.COMMENT3 as string} />
              <Field label="Комментарий 4" value={data.order.COMMENT4 as string} />
              <Field label="Менеджер" value={data.order.SALESMAN as string} />
              <Field label="Транспорт" value={data.order.TRANSPORTNUMBER as string} />

              {data.shipments.length > 0 && (
                <>
                  <div className="modal-section-title" style={{ marginTop: 12 }}>
                    Отгрузки ({data.shipments.length})
                  </div>
                  {data.shipments.map((s, i) => (
                    <div key={i} className="modal-shipment">
                      <Field label="№" value={s.SERNR as string} />
                      <Field label="Дата отгрузки" value={s.SHIPDATE as string} />
                      <Field label="Статус" value={s.SORTING as string} />
                      <Field label="ТТН NP" value={s.NPINTDOCNUMBER as string} />
                    </div>
                  ))}
                </>
              )}
            </>
          ) : (
            <div className="modal-loading">Заказ не найден</div>
          )}
        </div>
      </div>
    </div>
  );
}
