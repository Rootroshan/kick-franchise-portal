"use client";
/* eslint-disable @next/next/no-img-element -- local object URLs are previewed before a permanent tenant URL exists. */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  AlertCircle, ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, ChevronLeft,
  Clipboard, CloudUpload, Globe2, HelpCircle, Image as ImageIcon, Loader2, LockKeyhole,
  Mail, Palette, RefreshCw, ShieldCheck, Trash2, UserRound, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchJson } from "@/lib/fetchJson";
import { cn } from "@/lib/utils";
import { createBrandSchema, supportedBrandFonts } from "@/server/modules/tenants/schemas";
import { PortalLoginLinksPanel } from "@/components/admin/PortalLoginLinksPanel";

type WizardValues = {
  brandName: string;
  status: "active" | "draft";
  portalDomain: string;
  branding: { logoReference?: string; primary: string; secondary: string; font: (typeof supportedBrandFonts)[number] };
  admin: { sendInvitation: boolean; firstName: string; lastName: string; email: string; personalMessage: string };
  confirmation: boolean;
  idempotencyKey: string;
};

type Availability = "not-checked" | "checking" | "available" | "connected" | "invalid" | "error";
type Verification = "not-configured" | "pending" | "checking" | "verified" | "failed";

const STEPS = [
  { title: "Brand Details", short: "Tell us about the brand", icon: Building2 },
  { title: "Branding", short: "Upload the logo and customise portal styling", icon: Palette },
  { title: "Domain", short: "Connect and verify the portal domain", icon: Globe2 },
  { title: "Admin Access", short: "Invite the franchisor administrator", icon: UserRound },
  { title: "Review", short: "Confirm the details and create the brand", icon: ShieldCheck },
] as const;

function normaliseDomain(raw: string) {
  let value = raw.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  value = (value.split(/[/?#]/)[0] ?? "").split(":")[0] ?? "";
  return value.replace(/\.$/, "");
}

function validPortalDomain(value: string) {
  return /^portal\.[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(value);
}

export function CreateTenantForm({ cnameTarget }: { cnameTarget: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [availability, setAvailability] = useState<Availability>("not-checked");
  const [verification, setVerification] = useState<Verification>("not-configured");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoProgress, setLogoProgress] = useState(0);
  const [logoUploading, setLogoUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const form = useForm<WizardValues>({
    resolver: zodResolver(createBrandSchema),
    mode: "onBlur",
    defaultValues: {
      brandName: "",
      status: "draft",
      portalDomain: "",
      branding: { primary: "#2563EB", secondary: "#0F1C35", font: "Inter" },
      admin: { sendInvitation: true, firstName: "", lastName: "", email: "", personalMessage: "" },
      confirmation: false,
      idempotencyKey: crypto.randomUUID(),
    },
  });
  const { register, watch, setValue, getValues, trigger, formState: { errors, isDirty } } = form;
  const values = watch();
  const domain = normaliseDomain(values.portalDomain || "");

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty || submitting) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, submitting]);

  useEffect(() => {
    if (!values.portalDomain) {
      setAvailability("not-checked");
      return;
    }
    if (!validPortalDomain(domain)) {
      setAvailability("invalid");
      return;
    }
    setAvailability("checking");
    const timer = window.setTimeout(async () => {
      try {
        const result = await fetchJson<{ available: boolean; normalisedDomain: string }>("/api/admin/domains/check", {
          method: "POST", body: JSON.stringify({ domain }),
        });
        setValue("portalDomain", result.normalisedDomain, { shouldDirty: true });
        setAvailability(result.available ? "available" : "connected");
      } catch {
        setAvailability("error");
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [domain, setValue, values.portalDomain]);

  const previewFont = values.branding.font === "System UI" ? "system-ui" : values.branding.font;
  const logoInitial = (values.brandName || "Brand").trim().charAt(0).toUpperCase();

  async function validateStep(index: number) {
    if (index === 0) return trigger(["brandName", "status"]);
    if (index === 1) return trigger(["branding.primary", "branding.secondary", "branding.font"]);
    if (index === 2) {
      const valid = await trigger("portalDomain");
      if (!valid || availability !== "available") {
        if (availability === "connected") toast.error("This portal domain is already connected.");
        else if (availability !== "checking") toast.error("Enter an available portal domain before continuing.");
        return false;
      }
      return true;
    }
    if (index === 3) {
      return values.admin.sendInvitation
        ? trigger(["admin.firstName", "admin.lastName", "admin.email", "admin.personalMessage"])
        : trigger(["admin.personalMessage"]);
    }
    return trigger("confirmation");
  }

  async function next() {
    if (!(await validateStep(step))) return;
    setCompleted((current) => current.includes(step) ? current : [...current, step]);
    setStep((current) => Math.min(4, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadLogo(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return toast.error("Use a PNG, JPG, JPEG, or WEBP image.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Logo files must be 5 MB or smaller.");
    setLogoUploading(true);
    setLogoProgress(0);
    try {
      // Posted to our own server, which relays the file to R2 itself — a
      // server-to-server PUT, not a browser-facing presigned URL, so it
      // doesn't depend on the R2 bucket's CORS policy allowing this origin.
      const result = await new Promise<{ logoReference: string }>((resolve, reject) => {
        const form = new FormData();
        form.append("file", file);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/admin/brand-logo/upload");
        xhr.upload.onprogress = (event) => event.lengthComputable && setLogoProgress(Math.round((event.loaded / event.total) * 100));
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              return resolve(JSON.parse(xhr.responseText));
            } catch {
              return reject(new Error("Upload failed."));
            }
          }
          let message = "Upload failed.";
          try {
            const parsed = JSON.parse(xhr.responseText);
            if (typeof parsed?.error === "string") message = parsed.error;
          } catch {
            // Non-JSON error body — fall back to the generic message.
          }
          reject(new Error(message));
        };
        xhr.onerror = () => reject(new Error("Upload failed."));
        xhr.send(form);
      });
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogoPreview(URL.createObjectURL(file));
      setValue("branding.logoReference", result.logoReference, { shouldDirty: true });
      setLogoProgress(100);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Logo upload failed.");
    } finally {
      setLogoUploading(false);
    }
  }

  async function verifyDomain() {
    if (!validPortalDomain(domain)) return;
    setVerification("checking");
    try {
      const result = await fetchJson<{ status: "VERIFIED" | "PENDING" | "FAILED"; message: string }>("/api/admin/domains/verify", {
        method: "POST", body: JSON.stringify({ domain }),
      });
      setVerification(result.status === "VERIFIED" ? "verified" : result.status === "PENDING" ? "pending" : "failed");
      setVerificationMessage(result.message);
    } catch (error) {
      setVerification("failed");
      setVerificationMessage(error instanceof Error ? error.message : "Verification failed.");
    }
  }

  async function createBrand() {
    if (!(await validateStep(4)) || submitting) return;
    setSubmitting(true);
    try {
      const payload = getValues();
      const result = await fetchJson<{ brand: { id: string }; invitationWarning?: string }>("/api/admin/brands", {
        method: "POST", body: JSON.stringify(payload),
      });
      toast.success("Brand created successfully.");
      if (result.invitationWarning) toast.warning(result.invitationWarning);
      router.push(`/admin/brands/${result.brand.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Brand provisioning failed. Your information has been preserved.");
      setSubmitting(false);
    }
  }

  function requestCancel() {
    if (isDirty) setDiscardOpen(true);
    else router.push("/admin/brands");
  }

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <button type="button" onClick={requestCancel} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to Brands
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">New Brand</h1>
          <p className="mt-1 text-sm text-muted-foreground">Set up a new franchise brand and configure its dedicated portal.</p>
        </div>
        <Button type="button" variant="outline" onClick={requestCancel} disabled={submitting} className="shrink-0">
          <X className="mr-2 h-4 w-4" /> Cancel
        </Button>
      </div>

      <WizardStepper step={step} completed={completed} onStep={(nextStep) => completed.includes(nextStep) && !submitting && setStep(nextStep)} />

      <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
        <main className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
          {step === 0 && <BrandDetails values={values} register={register} setValue={setValue} errors={errors} />}
          {step === 1 && (
            <Branding values={values} register={register} setValue={setValue} errors={errors} previewFont={previewFont}
              logoPreview={logoPreview} logoInitial={logoInitial} logoUploading={logoUploading} logoProgress={logoProgress}
              fileInput={fileInput} uploadLogo={uploadLogo} removeLogo={() => { if (logoPreview) URL.revokeObjectURL(logoPreview); setLogoPreview(null); setValue("branding.logoReference", undefined, { shouldDirty: true }); }} />
          )}
          {step === 2 && (
            <DomainStep domain={domain} register={register} errors={errors} availability={availability} verification={verification}
              verificationMessage={verificationMessage} verifyDomain={verifyDomain} cnameTarget={cnameTarget} copied={copied}
              copy={() => { navigator.clipboard.writeText(cnameTarget); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }} />
          )}
          {step === 3 && <AdminAccess values={values} register={register} setValue={setValue} errors={errors} />}
          {step === 4 && <Review values={values} domain={domain} availability={availability} verification={verification} logoPreview={logoPreview} setStep={setStep} register={register} errors={errors} />}

          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            {step === 0 ? (
              <Button type="button" variant="outline" onClick={requestCancel} disabled={submitting}>Cancel</Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => setStep((current) => current - 1)} disabled={submitting}>
                <ChevronLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            )}
            {step < 4 ? (
              <Button type="button" onClick={next} disabled={logoUploading || availability === "checking"}>
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={createBrand} disabled={!values.confirmation || submitting} className="min-w-[180px]">
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Brand…</> : <><ShieldCheck className="mr-2 h-4 w-4" /> Create Brand</>}
              </Button>
            )}
          </div>
          {submitting && <p className="mt-3 text-right text-xs text-muted-foreground">Creating brand and provisioning portal…</p>}
        </main>

        <aside className="flex min-w-0 flex-col gap-5">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">What’s Next?</h2>
            <ol className="mt-5 space-y-4">
              {STEPS.map((item, index) => {
                const active = index === step;
                const done = completed.includes(index);
                const Icon = item.icon;
                return (
                  <li key={item.title} className="flex gap-3">
                    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", active ? "bg-primary text-primary-foreground" : done ? "bg-status-success/15 text-status-success" : "bg-muted text-muted-foreground")}>
                      {done ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                    </span>
                    <div><p className={cn("text-sm font-medium", active && "text-primary")}>{item.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.short}</p></div>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2"><HelpCircle className="h-5 w-5 text-muted-foreground" /><h2 className="font-semibold">Need Help?</h2></div>
            <p className="mt-4 text-sm text-muted-foreground">Learn how to set up a brand portal.</p>
          </div>
        </aside>
      </div>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><div><DialogTitle>Discard new brand?</DialogTitle><p className="mt-1 text-sm text-muted-foreground">Your entered brand information will be lost.</p></div></DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDiscardOpen(false)}>Continue Editing</Button>
            <Button type="button" variant="destructive" onClick={() => router.push("/admin/brands")}>Discard Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WizardStepper({ step, completed, onStep }: { step: number; completed: number[]; onStep: (step: number) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <ol className="grid min-w-[680px] grid-cols-5 gap-2">
        {STEPS.map((item, index) => {
          const active = index === step;
          const done = completed.includes(index);
          return (
            <li key={item.title} className="relative">
              {index < 4 && <span className={cn("absolute left-9 right-0 top-4 h-px", done ? "bg-primary" : "bg-border")} />}
              <button type="button" onClick={() => onStep(index)} disabled={!done} className="relative z-10 text-left disabled:cursor-default">
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold", active ? "border-primary bg-primary text-primary-foreground" : done ? "border-primary bg-card text-primary" : "border-border bg-card text-foreground")}>{done && !active ? <Check className="h-4 w-4" /> : index + 1}</span>
                <span className={cn("mt-2 block text-sm font-semibold", active && "text-primary")}>{item.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{index === 0 ? "Basic information" : index === 1 ? "Logo, colours & style" : index === 2 ? "Portal domain & verification" : index === 3 ? "Franchisor admin" : "Confirm & create"}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

type FormBits = { values: WizardValues; register: ReturnType<typeof useForm<WizardValues>>["register"]; setValue: ReturnType<typeof useForm<WizardValues>>["setValue"]; errors: ReturnType<typeof useForm<WizardValues>>["formState"]["errors"] };

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <div className="mb-6"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>;
}
function ErrorText({ message, id }: { message?: string; id?: string }) { return message ? <p id={id} role="alert" className="mt-1.5 text-xs text-status-error">{message}</p> : null; }

function BrandDetails({ values, register, setValue, errors }: FormBits) {
  return <><SectionHeading title="Brand Information" description="Provide the basic details of your franchise brand." />
    <div><Label htmlFor="brand-name">Brand Name <span className="text-status-error">*</span></Label><Input id="brand-name" placeholder="Acme Burgers" maxLength={100} aria-invalid={!!errors.brandName} {...register("brandName")} /><ErrorText message={errors.brandName?.message} /></div>
    <fieldset className="mt-6"><legend className="text-sm font-medium">Brand Status <span className="text-status-error">*</span></legend><div className="mt-2 grid gap-3 sm:grid-cols-2">
      {(["active", "draft"] as const).map((status) => <label key={status} className={cn("cursor-pointer rounded-lg border p-4 transition-colors", values.status === status ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40")}>
        <input type="radio" className="sr-only" checked={values.status === status} onChange={() => setValue("status", status, { shouldDirty: true })} />
        <span className="flex items-center gap-2 text-sm font-semibold"><span className={cn("h-4 w-4 rounded-full border p-[3px]", values.status === status ? "border-primary" : "border-input")}><span className={cn("block h-full w-full rounded-full", values.status === status && "bg-primary")} /></span>{status === "active" ? "Active" : "Draft"}{status === "draft" && <span className="ml-auto rounded-full bg-status-success/15 px-2 py-0.5 text-[10px] text-status-success">Recommended</span>}</span>
        <span className="mt-2 block pl-6 text-xs leading-5 text-muted-foreground">{status === "active" ? "The brand portal becomes accessible after the domain has been verified and provisioning is complete." : "The brand remains hidden from franchise users until activated."}</span>
      </label>)}
    </div></fieldset>
  </>;
}

function Branding(props: FormBits & { previewFont: string; logoPreview: string | null; logoInitial: string; logoUploading: boolean; logoProgress: number; fileInput: React.RefObject<HTMLInputElement>; uploadLogo: (file?: File) => void; removeLogo: () => void }) {
  const { values, register, setValue, errors, previewFont, logoPreview, logoInitial, logoUploading, logoProgress, fileInput, uploadLogo, removeLogo } = props;
  return <><SectionHeading title="Brand Appearance" description="Upload the brand identity and customise how its franchise portal will appear." />
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-5">
        <div><Label>Brand Logo</Label><div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); uploadLogo(e.dataTransfer.files[0]); }} className="mt-2 flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-input bg-muted/20 p-5 text-center">
          {logoPreview ? <><img src={logoPreview} alt="Brand logo preview" className="h-20 w-20 rounded-lg object-contain" /><div className="mt-3 flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => fileInput.current?.click()}>Replace</Button><Button type="button" size="sm" variant="ghost" onClick={removeLogo}><Trash2 className="mr-1.5 h-4 w-4" />Remove</Button></div></> : <><CloudUpload className="h-8 w-8 text-primary" /><p className="mt-2 text-sm font-medium">Drop your logo here</p><p className="mt-1 text-xs text-muted-foreground">PNG, JPG or WEBP · maximum 5 MB</p><Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => fileInput.current?.click()}>Select File</Button></>}
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0])} />
          {logoUploading && <div className="mt-3 w-full"><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${logoProgress}%` }} /></div><p className="mt-1 text-xs text-muted-foreground">Uploading {logoProgress}%</p></div>}
        </div></div>
        <div className="grid gap-4 sm:grid-cols-2">{(["primary", "secondary"] as const).map((key) => <div key={key}><Label htmlFor={`colour-${key}`}>{key === "primary" ? "Primary Colour" : "Secondary Colour"}</Label><div className="mt-1 flex items-center gap-2"><input type="color" aria-label={`${key} colour picker`} value={values.branding[key]} onChange={(e) => setValue(`branding.${key}`, e.target.value.toUpperCase(), { shouldDirty: true, shouldValidate: true })} className="h-10 w-11 rounded-md border border-input bg-background p-1" /><Input id={`colour-${key}`} className="font-mono uppercase" maxLength={7} aria-invalid={!!errors.branding?.[key]} {...register(`branding.${key}`)} /></div><ErrorText message={errors.branding?.[key]?.message} /></div>)}</div>
        <div><Label htmlFor="brand-font">Font Selection</Label><Select id="brand-font" {...register("branding.font")}>{supportedBrandFonts.map((font) => <option key={font} value={font}>{font}</option>)}</Select></div>
      </div>
      <div><Label>Live Portal Preview</Label><div className="mt-2 overflow-hidden rounded-xl border border-border bg-background shadow-sm" style={{ fontFamily: previewFont }}><div className="flex items-center justify-between px-4 py-3 text-white" style={{ backgroundColor: values.branding.secondary }}><div className="flex items-center gap-2">{logoPreview ? <img src={logoPreview} alt="" className="h-8 w-8 rounded object-contain" /> : <span className="flex h-8 w-8 items-center justify-center rounded bg-white/15 font-bold">{logoInitial}</span>}<span className="text-sm font-semibold">{values.brandName || "Your Brand"}</span></div><span className="text-xs text-white/70">Portal</span></div><div className="flex min-h-64"><div className="w-20 border-r border-border bg-muted/30 p-3"><div className="h-2 rounded bg-muted-foreground/20" /><div className="mt-3 h-2 rounded bg-muted-foreground/10" /><div className="mt-3 h-2 rounded bg-muted-foreground/10" /></div><div className="flex-1 p-5"><span className="text-xs font-medium" style={{ color: values.branding.primary }}>Dashboard</span><h3 className="mt-2 text-lg font-bold">Welcome back</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">Manage your locations, tasks and brand resources from one place.</p><button type="button" className="mt-5 rounded-md px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: values.branding.primary }}>View tasks</button></div></div></div></div>
    </div>
  </>;
}

function DomainStep({ domain, register, errors, availability, verification, verificationMessage, verifyDomain, cnameTarget, copied, copy }: { domain: string; register: FormBits["register"]; errors: FormBits["errors"]; availability: Availability; verification: Verification; verificationMessage: string; verifyDomain: () => void; cnameTarget: string; copied: boolean; copy: () => void }) {
  const valid = validPortalDomain(domain);
  return <><SectionHeading title="Portal Domain" description="Connect the dedicated domain franchisees will use to access this brand portal." />
    <div><Label htmlFor="portal-domain">Portal Domain <span className="text-status-error">*</span></Label><div className="mt-1 flex min-w-0 rounded-md border border-input bg-background focus-within:border-primary"><span className="flex items-center border-r border-input bg-muted/40 px-3 text-sm text-muted-foreground">https://</span><input id="portal-domain" className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none" placeholder="portal.acmeburgers.com" aria-invalid={!!errors.portalDomain} {...register("portalDomain", { onBlur: (e) => { e.target.value = normaliseDomain(e.target.value); } })} /><DomainAvailability status={availability} /></div><ErrorText message={errors.portalDomain?.message} />
      {domain && !domain.startsWith("portal.") && <p className="mt-1.5 flex items-center gap-1.5 text-xs text-status-warning"><AlertCircle className="h-3.5 w-3.5" />Portal domains must begin with portal.</p>}
    </div>
    {valid && <><div className="mt-5 rounded-lg border border-primary/20 bg-primary/5 p-4"><p className="text-xs font-medium text-muted-foreground">Portal URL Preview</p><p className="mt-1 break-all text-sm font-semibold text-primary">https://{domain}</p></div>
      <div className="mt-5 rounded-lg border border-border p-4"><div className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">DNS Configuration</h3></div><p className="mt-1 text-xs text-muted-foreground">Point your domain to the portal platform using this record.</p><div className="mt-4 grid min-w-0 grid-cols-[70px_70px_minmax(0,1fr)_auto] gap-2 rounded-md bg-muted/40 p-3 text-xs"><span className="text-muted-foreground">Type</span><span className="text-muted-foreground">Host</span><span className="text-muted-foreground">Value / Points To</span><span className="text-muted-foreground">TTL</span><strong>CNAME</strong><strong>portal</strong><strong className="break-all font-mono">{cnameTarget}</strong><strong>Automatic</strong></div><Button type="button" size="sm" variant="outline" className="mt-3" onClick={copy}><Clipboard className="mr-2 h-3.5 w-3.5" />{copied ? "Copied" : "Copy target"}</Button></div>
      <div className="mt-5 flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">Domain Verification</p><p className="mt-1 text-xs text-muted-foreground">{verificationMessage || "Run a live DNS check after adding the CNAME record."}</p><p className="mt-2 text-xs font-medium"><StatusDot status={verification} /></p></div><Button type="button" variant="outline" onClick={verifyDomain} disabled={verification === "checking"}>{verification === "checking" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Verify Domain</Button></div>
    </>}
  </>;
}

function DomainAvailability({ status }: { status: Availability }) { const label = status === "checking" ? "Checking" : status === "available" ? "Available" : status === "connected" ? "Already connected" : status === "invalid" ? "Invalid" : status === "error" ? "Check failed" : ""; if (!label) return null; return <span className={cn("mr-2 flex shrink-0 items-center gap-1 self-center rounded-full px-2 py-1 text-[11px] font-medium", status === "available" ? "bg-status-success/15 text-status-success" : status === "checking" ? "bg-muted text-muted-foreground" : "bg-status-error/10 text-status-error")}>{status === "checking" ? <Loader2 className="h-3 w-3 animate-spin" /> : status === "available" ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}{label}</span>; }
function StatusDot({ status }: { status: Verification }) { const label = status === "verified" ? "Verified" : status === "checking" ? "Checking" : status === "pending" ? "Pending DNS" : status === "failed" ? "Verification failed" : "Not configured"; return <span className="inline-flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", status === "verified" ? "bg-status-success" : status === "failed" ? "bg-status-error" : "bg-status-warning")} />{label}</span>; }

function AdminAccess({ values, register, setValue, errors }: FormBits) { return <><SectionHeading title="Franchisor Administrator" description="Invite the first administrator who will manage this franchise brand." />
  <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-border p-4"><div><p className="text-sm font-semibold">Send Invitation</p><p className="mt-1 text-xs text-muted-foreground">The administrator will receive an invitation to join the new portal.</p></div><button type="button" role="switch" aria-checked={values.admin.sendInvitation} onClick={() => setValue("admin.sendInvitation", !values.admin.sendInvitation, { shouldDirty: true })} className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", values.admin.sendInvitation ? "bg-primary" : "bg-muted-foreground/30")}><span className={cn("absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform", values.admin.sendInvitation ? "translate-x-5" : "translate-x-0")} /></button></label>
  <div className={cn("mt-5 space-y-4", !values.admin.sendInvitation && "pointer-events-none opacity-50")}><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="admin-first">First Name *</Label><Input id="admin-first" disabled={!values.admin.sendInvitation} aria-invalid={!!errors.admin?.firstName} {...register("admin.firstName")} /><ErrorText message={errors.admin?.firstName?.message} /></div><div><Label htmlFor="admin-last">Last Name *</Label><Input id="admin-last" disabled={!values.admin.sendInvitation} aria-invalid={!!errors.admin?.lastName} {...register("admin.lastName")} /><ErrorText message={errors.admin?.lastName?.message} /></div></div><div><Label htmlFor="admin-email">Email Address *</Label><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="admin-email" type="email" disabled={!values.admin.sendInvitation} className="pl-9" aria-invalid={!!errors.admin?.email} {...register("admin.email")} /></div><ErrorText message={errors.admin?.email?.message} /></div><div><Label>Role</Label><div className="mt-1 flex h-10 items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm"><LockKeyhole className="h-4 w-4 text-muted-foreground" />Franchisor Administrator<span className="ml-auto text-xs text-muted-foreground">Fixed role</span></div></div><div><Label htmlFor="personal-message">Personal Message <span className="text-muted-foreground">(optional)</span></Label><textarea id="personal-message" maxLength={500} disabled={!values.admin.sendInvitation} className="mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/30" {...register("admin.personalMessage")} /><div className="mt-1 flex justify-between"><ErrorText message={errors.admin?.personalMessage?.message} /><span className="ml-auto text-xs text-muted-foreground">{values.admin.personalMessage.length}/500</span></div></div></div>
  {!values.admin.sendInvitation && <div className="mt-5 rounded-lg border border-status-warning/30 bg-status-warning/5 p-3 text-sm text-muted-foreground">The brand will be created without an administrator invitation. You can invite one later from Brand Details.</div>}
  </>; }

function Review({ values, domain, availability, verification, logoPreview, setStep, register, errors }: { values: WizardValues; domain: string; availability: Availability; verification: Verification; logoPreview: string | null; setStep: (step: number) => void; register: FormBits["register"]; errors: FormBits["errors"] }) { return <><SectionHeading title="Review and Create" description="Check the information below before creating the brand portal." />
  <div className="grid gap-4 sm:grid-cols-2"><ReviewCard title="Brand Details" edit={() => setStep(0)}><ReviewRow label="Brand name" value={values.brandName} /><ReviewRow label="Brand status" value={values.status === "active" ? "Active (after verification)" : "Draft"} /></ReviewCard><ReviewCard title="Branding" edit={() => setStep(1)}><div className="mb-3 flex items-center gap-3">{logoPreview ? <img src={logoPreview} alt="Brand logo" className="h-10 w-10 rounded-md object-contain" /> : <span className="flex h-10 w-10 items-center justify-center rounded-md bg-muted"><ImageIcon className="h-5 w-5 text-muted-foreground" /></span>}<span className="text-sm text-muted-foreground">{logoPreview ? "Logo uploaded" : "No logo uploaded"}</span></div><ReviewRow label="Primary" value={values.branding.primary} colour={values.branding.primary} /><ReviewRow label="Secondary" value={values.branding.secondary} colour={values.branding.secondary} /><ReviewRow label="Font" value={values.branding.font} /></ReviewCard><ReviewCard title="Portal Domain" edit={() => setStep(2)}><ReviewRow label="Domain" value={domain} /><ReviewRow label="Portal URL" value={`https://${domain}`} /><ReviewRow label="Availability" value={availability === "available" ? "Available" : availability} /><ReviewRow label="DNS status" value={verification === "verified" ? "Configured" : "Pending DNS"} /><ReviewRow label="Verification" value={verification.replace("-", " ")} /></ReviewCard><ReviewCard title="Franchisor Administrator" edit={() => setStep(3)}>{values.admin.sendInvitation ? <><ReviewRow label="Name" value={`${values.admin.firstName} ${values.admin.lastName}`} /><ReviewRow label="Email" value={values.admin.email} /><ReviewRow label="Role" value="Franchisor Administrator" /><ReviewRow label="Invitation" value="Enabled" /></> : <ReviewRow label="Invitation" value="Disabled" />}</ReviewCard></div>
  {domain && <div className="mt-4"><PortalLoginLinksPanel hostname={domain} /></div>}
  <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4"><input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-input accent-primary" {...register("confirmation")} /><span className="text-sm font-medium">I confirm that the brand and portal information is correct.</span></label><ErrorText message={errors.confirmation?.message} />
  </>; }
function ReviewCard({ title, edit, children }: { title: string; edit: () => void; children: React.ReactNode }) { return <section className="rounded-lg border border-border p-4"><div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-semibold">{title}</h3><button type="button" onClick={edit} className="text-xs font-semibold text-primary hover:underline">Edit</button></div><dl className="space-y-2">{children}</dl></section>; }
function ReviewRow({ label, value, colour }: { label: string; value: string; colour?: string }) { return <div className="flex min-w-0 justify-between gap-4 text-xs"><dt className="shrink-0 text-muted-foreground">{label}</dt><dd className="flex min-w-0 items-center gap-1.5 break-all text-right font-medium">{colour && <span className="h-3 w-3 shrink-0 rounded-full border border-border" style={{ backgroundColor: colour }} />}{value || "—"}</dd></div>; }
