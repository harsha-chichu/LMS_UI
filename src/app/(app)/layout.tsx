import { AccentSync } from "@/components/common/AccentSync";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AccentSync />
      {children}
    </div>
  );
}
