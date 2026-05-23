import { useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhotoCapture } from "@/components/photo-capture";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import { dataUrlToBlob, uploadDeliveryFile } from "@/lib/delivery-storage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Loader2, PenLine } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  tripId: string;
  driverId: string;
  routePointId?: string | null;
  defaultPosition?: { lat: number; lng: number } | null;
  onConfirmed?: () => void;
}

export function DeliveryConfirmDialog({
  open, onOpenChange, companyId, tripId, driverId, routePointId, defaultPosition, onConfirmed,
}: Props) {
  const sigRef = useRef<SignaturePadHandle>(null);
  const [recipientName, setRecipientName] = useState("");
  const [recipientDoc, setRecipientDoc] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [hasSignature, setHasSignature] = useState(false);
  const [saving, setSaving] = useState(false);

  async function obtainPosition(): Promise<{ lat: number; lng: number } | null> {
    if (defaultPosition) return defaultPosition;
    if (!("geolocation" in navigator)) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000 },
      );
    });
  }

  async function submit() {
    if (!recipientName.trim()) { toast.error("Informe o nome de quem recebeu"); return; }
    if (photos.length === 0 && !hasSignature) {
      toast.error("Adicione pelo menos uma foto OU assine para confirmar");
      return;
    }

    setSaving(true);
    try {
      // 1) Upload photos in parallel
      const photoPaths = await Promise.all(
        photos.map((f) => uploadDeliveryFile(companyId, tripId, f, "photo")),
      );

      // 2) Upload signature if drawn
      let signaturePath: string | null = null;
      if (hasSignature && sigRef.current) {
        const dataUrl = sigRef.current.toDataURL("image/png");
        const blob = dataUrlToBlob(dataUrl);
        signaturePath = await uploadDeliveryFile(companyId, tripId, blob, "signature");
      }

      // 3) Capture GPS
      const pos = await obtainPosition();

      // 4) Insert trip_deliveries row
      const { error } = await supabase.from("trip_deliveries" as any).insert({
        company_id: companyId,
        trip_id: tripId,
        route_point_id: routePointId ?? null,
        driver_id: driverId,
        recipient_name: recipientName.trim(),
        recipient_doc: recipientDoc.trim() || null,
        notes: notes.trim() || null,
        photo_paths: photoPaths,
        signature_path: signaturePath,
        lat: pos?.lat ?? null,
        lng: pos?.lng ?? null,
      });
      if (error) throw error;

      toast.success("Entrega confirmada e enviada!");
      onConfirmed?.();
      // reset
      setRecipientName("");
      setRecipientDoc("");
      setNotes("");
      setPhotos([]);
      sigRef.current?.clear();
      setHasSignature(false);
      onOpenChange(false);
    } catch (e: any) {
      const msg = e?.message ?? "Falha ao salvar entrega";
      if (/bucket.*not.*found|404/i.test(msg)) {
        toast.error(
          "Bucket 'delivery-proofs' não existe no Supabase. Crie em Storage e rode a migration 20260527000000.",
          { duration: 9000 },
        );
      } else if (/row-level security|new row violates/i.test(msg)) {
        toast.error("Sem permissão. Rode a migration 20260527000000_delivery_proofs.sql.", { duration: 8000 });
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirmar entrega</DialogTitle>
          <DialogDescription>
            Tire foto da mercadoria/destinatário e peça a assinatura no celular.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Quem recebeu *</Label>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Nome do destinatário"
                className="h-11"
                maxLength={100}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>CPF/Documento (opcional)</Label>
              <Input
                value={recipientDoc}
                onChange={(e) => setRecipientDoc(e.target.value)}
                placeholder="Ex.: 000.000.000-00"
                className="h-11"
                maxLength={30}
              />
            </div>
          </div>

          <div>
            <Label>Fotos da entrega</Label>
            <div className="mt-1.5">
              <PhotoCapture value={photos} onChange={setPhotos} max={4} />
            </div>
          </div>

          <div>
            <Label className="flex items-center gap-1.5">
              <PenLine className="h-3.5 w-3.5" /> Assinatura do destinatário
            </Label>
            <div className="mt-1.5">
              <SignaturePad ref={sigRef} height={180} onChange={setHasSignature} />
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={400}
              placeholder="Ex.: entregue na portaria"
            />
          </div>

          <Button onClick={submit} disabled={saving} className="h-12 w-full text-base">
            {saving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…</>
            ) : (
              <><CheckCircle2 className="mr-2 h-5 w-5" /> Confirmar entrega</>
            )}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Sua localização atual será registrada junto com o comprovante (LGPD).
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
