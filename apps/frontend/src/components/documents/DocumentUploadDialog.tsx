import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import api from '../../lib/api';
import { PatientCombobox } from '../shared/PatientCombobox';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from '../ui/toaster';

const schema = z.object({
  patientId: z.string().min(1, 'Patient requis'),
  name: z.string().min(1, 'Nom requis'),
  type: z.enum(['ANALYSIS', 'PRESCRIPTION', 'REPORT', 'CONSENT', 'OTHER']),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPatientId?: string;
}

export function DocumentUploadDialog({
  open,
  onOpenChange,
  defaultPatientId,
}: DocumentUploadDialogProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      patientId: defaultPatientId ?? '',
      name: '',
      type: 'OTHER',
      description: '',
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: FormData) => {
      if (!selectedFile) throw new Error('Aucun fichier selectionne');

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('patientId', data.patientId);
      formData.append('name', data.name);
      formData.append('type', data.type);
      if (data.description) formData.append('description', data.description);

      return api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: 'Document uploade' });
      reset();
      setSelectedFile(null);
      onOpenChange(false);
    },
  });

  const inputClass =
    'w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Uploader un document</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
          {/* File */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Fichier *</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-input rounded-lg p-6 text-center cursor-pointer hover:border-primary/30 transition-colors"
            >
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              {selectedFile ? (
                <div>
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(selectedFile.size / 1024).toFixed(1)} Ko
                  </p>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Cliquez pour choisir un fichier</p>
                  <p className="text-xs text-muted-foreground mt-1">Max 10 Mo</p>
                </div>
              )}
            </div>
          </div>

          {/* Patient */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Patient *</label>
            <Controller
              control={control}
              name="patientId"
              render={({ field }) => (
                <PatientCombobox value={field.value} onChange={(id) => field.onChange(id ?? '')} />
              )}
            />
            {errors.patientId && (
              <p className="text-xs text-destructive mt-1">{errors.patientId.message}</p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Nom du document *</label>
            <input {...register('name')} placeholder="Bilan sanguin..." className={inputClass} />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Type</label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANALYSIS">Analyse</SelectItem>
                    <SelectItem value="PRESCRIPTION">Prescription</SelectItem>
                    <SelectItem value="REPORT">Rapport</SelectItem>
                    <SelectItem value="CONSENT">Consentement</SelectItem>
                    <SelectItem value="OTHER">Autre</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              {...register('description')}
              rows={2}
              className={`${inputClass} resize-none`}
              placeholder="Description du document..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending || !selectedFile}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Uploader'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
