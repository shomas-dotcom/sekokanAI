import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const fieldBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30";

export function Input(props: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  const { className, ref, ...rest } = props;
  return <input {...rest} ref={ref} className={cx(fieldBase, className)} />;
}

export function Textarea(
  props: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }
) {
  const { className, ref, ...rest } = props;
  return <textarea {...rest} ref={ref} className={cx(fieldBase, className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props;
  return <select {...rest} className={cx(fieldBase, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%2364748b%22><path fill-rule=%22evenodd%22 d=%22M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z%22 clip-rule=%22evenodd%22/></svg>')] bg-[length:1.1em] bg-[right_0.75rem_center] bg-no-repeat pr-9", className)} />;
}

export function Label(props: LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  const { className, required, children, ...rest } = props;
  return (
    <label {...rest} className={cx("flex flex-col gap-1.5 text-sm font-medium text-slate-700", className)}>
      {children}
      {required && <span className="text-rose-500"> *</span>}
    </label>
  );
}

export function FieldLabel({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
      <span>
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

const buttonVariants = {
  primary:
    "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm shadow-orange-600/25 hover:from-amber-400 hover:to-orange-500",
  secondary:
    "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100",
  danger: "text-rose-600 underline decoration-rose-300 underline-offset-2 hover:text-rose-700",
  // AIが関わった操作であることを示す配色(音声入力など)。通常の主要アクションとは区別する。
  ai: "bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-600/20 hover:from-indigo-500 hover:to-violet-500",
};

export function Button(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonVariants }
) {
  const { className, variant = "primary", ...rest } = props;
  const isLink = variant === "danger" || variant === "ghost";
  return (
    <button
      {...rest}
      className={cx(
        isLink
          ? "text-sm font-medium disabled:opacity-50"
          : "rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50",
        buttonVariants[variant],
        className
      )}
    />
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cx("rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50", className)}>
      {children}
    </div>
  );
}

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600",
        className
      )}
    >
      {children}
    </span>
  );
}
