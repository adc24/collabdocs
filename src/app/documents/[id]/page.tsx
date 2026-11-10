import DocumentLoader from "@/components/document-editor";
export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DocumentLoader id={id} />;
}
