import type { JsonLdObject } from "@/features/routines/lib/routineStructuredData";

type RoutineStructuredDataProps = {
  data: JsonLdObject | null;
};

const serializeJsonLd = (data: JsonLdObject) =>
  JSON.stringify(data).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e");

export const RoutineStructuredData = ({
  data,
}: RoutineStructuredDataProps) => {
  if (!data) {
    return null;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
};
