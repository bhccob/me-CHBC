import { type MetaFunction, useParams } from 'react-router';
import { LabPage } from '~/lab/LabPage';
import '~/lab/lab.css';
import { HANDLES, type RouteHandle } from '../handle';

// LAB ONLY (throwaway): the new opening's previews, at /lab/<id>/ in a LAB=1 dev server. Deleted once Bob has chosen.
export const meta: MetaFunction = ({ params }) => [{ title: `Lab ${(params.id ?? '').toUpperCase()} · new opening | Bob Chung` }, { name: 'robots', content: 'noindex, nofollow' }];

export const handle: RouteHandle = HANDLES.lab;

export default function Lab() {
  const { id = '' } = useParams();
  return <LabPage key={id} id={id} />;
}
