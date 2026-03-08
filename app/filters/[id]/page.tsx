import FilterPageClient from './FilterPageClient';

interface Props {
  params: { id: string };
}

export default function FilterPage({ params }: Props) {
  return <FilterPageClient filterId={params.id} />;
}