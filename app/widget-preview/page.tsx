import WidgetPreviewHost from "@/components/WidgetPreviewHost";

export default async function WidgetPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ assistant_id?: string }>;
}) {
  const { assistant_id: assistantId = "" } = await searchParams;
  return <WidgetPreviewHost assistantId={assistantId} />;
}
