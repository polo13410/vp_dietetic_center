import { ChevronDown, Download, Loader2 } from 'lucide-react';
import { useState } from 'react';

import type { Consultation, Patient, PatientAppointment } from '../../lib/patient-file';
import { cn } from '../../lib/utils';
import { LifeEventsPanel } from '../patient-file/LifeEventsPanel';
import { MeasurementsPanel } from '../patient-file/MeasurementsPanel';
import { Button } from '../ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { toast } from '../ui/toaster';

import { PatientAccessLog } from './PatientAccessLog';
import { PatientAppointments } from './PatientAppointments';
import { PatientTasks } from './PatientTasks';

/**
 * « Pour aller plus loin », folded by default (docs/REFONTE.md § 2, principle 5): extra measurements,
 * life events, tasks, appointments, access history and the PDF export.
 */
export function PatientFurther({
  patient,
  appointments,
  sessions,
}: {
  patient: Patient;
  appointments: PatientAppointment[];
  sessions: Consultation[];
}) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const exportPdf = async () => {
    setExporting(true);
    try {
      const { exportPatientPdf } = await import('../../lib/pdf-export');
      await exportPatientPdf(patient, appointments, sessions);
    } catch {
      toast({ title: 'Le PDF n’a pas pu être créé. Réessayez.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          Pour aller plus loin
          <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
            {!open && 'Mesures complémentaires, faits marquants, tâches, rendez-vous, accès, PDF'}
            <ChevronDown className={cn('transition-transform', open && 'rotate-180')} aria-hidden />
          </span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <MeasurementsPanel patientId={patient.id} />
          <LifeEventsPanel patientId={patient.id} />
          <PatientTasks patientId={patient.id} />
          <PatientAppointments appointments={appointments} />
        </div>
        <PatientAccessLog patientId={patient.id} />
        <div className="flex justify-end">
          <Button variant="outline" onClick={exportPdf} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            Exporter le dossier en PDF
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
