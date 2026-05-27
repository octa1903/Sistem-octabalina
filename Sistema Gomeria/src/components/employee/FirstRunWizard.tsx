import { useMemo } from 'react';
import type { Store } from '@/types';
import { needsFiscalSetup } from '@/services/storeService';
import { WizardShell } from './firstRun/WizardShell';
import { FiscalIdentityStep } from './firstRun/FiscalIdentityStep';
import { BootstrapAdminStep } from './firstRun/BootstrapAdminStep';

interface Props {
  store: Store;
  /**
   * True si la tienda NO tiene ningún empleado activo con `settings.manage`.
   * Se calcula en el padre (Layout) porque requiere I/O async.
   */
  needsAdmin: boolean;
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  /**
   * Llamado cuando el wizard completó todos los pasos. El padre debe re-evaluar
   * `needsFiscalSetup` y `needsAdminBootstrap` para decidir si se vuelve a mostrar.
   */
  onCompleted: () => void;
}

type Step = { id: 'fiscal' | 'admin'; label: string };

/**
 * Wizard multi-step de primer arranque. Muestra solo los pasos que faltan:
 *  - Datos fiscales (si `needsFiscalSetup(store)`)
 *  - Operador administrador (si `needsAdmin`)
 *
 * Si ninguno aplica, no se renderiza nada (el padre nunca debería montar este
 * componente en ese caso, pero defensivamente devolvemos null).
 */
export function FirstRunWizard({ store, needsAdmin, addToast, onCompleted }: Props) {
  const steps: Step[] = useMemo(() => {
    const arr: Step[] = [];
    if (needsFiscalSetup(store)) arr.push({ id: 'fiscal', label: 'Datos fiscales' });
    if (needsAdmin) arr.push({ id: 'admin', label: 'Operador admin' });
    return arr;
  }, [store, needsAdmin]);

  if (steps.length === 0) return null;

  const current = steps[0];
  const stepLabels = steps.map((s) => s.label);

  // Cuando un paso termina, llamamos a onCompleted; el padre re-evalúa y nos
  // re-renderiza con el próximo paso (o nos desmonta si ya no hay nada).
  function handleStepDone() {
    onCompleted();
  }

  return (
    <WizardShell
      title={`Configurá ${store.name}`}
      subtitle="Necesitamos un par de datos antes de empezar a operar."
      steps={stepLabels}
      currentStep={0}
      footer={null}
    >
      {current.id === 'fiscal' && (
        <FiscalIdentityStep store={store} addToast={addToast} onDone={handleStepDone} />
      )}
      {current.id === 'admin' && (
        <BootstrapAdminStep onCreated={handleStepDone} addToast={addToast} />
      )}
    </WizardShell>
  );
}
