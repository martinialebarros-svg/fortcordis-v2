"use client";

import DashboardLayout from "@/app/layout-dashboard";
import UltrassonografiaAbdominalForm from "../../components/UltrassonografiaAbdominalForm";

export default function EditarUltrassonografiaAbdominalPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <DashboardLayout>
      <UltrassonografiaAbdominalForm mode="edit" laudoId={params.id} />
    </DashboardLayout>
  );
}
