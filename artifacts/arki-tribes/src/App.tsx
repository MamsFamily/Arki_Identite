import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Shell } from '@/components/parts';
import { OwnerViewProvider } from '@/lib/owner-view';
import Directory from '@/pages/directory';
import TribePage from '@/pages/tribe';
import { MyTribes, CreateTribe } from '@/pages/account';
import Manage from '@/pages/manage';
import Login from '@/pages/login';
import JoinCommunity from '@/pages/join';
import Home from '@/pages/home';
import MySpace from '@/pages/my-space';
import MesDinos from '@/pages/mes-dinos';
import MesDinosCatalogue from '@/pages/mes-dinos-catalogue';
import Admin from '@/pages/admin';
import Cluster from '@/pages/cluster';
import { MapsPage, MapDetail } from '@/pages/maps';
import Mods from '@/pages/mods';
import Events from '@/pages/events';
import Shop from '@/pages/shop';
import Dons from '@/pages/dons';
import { ArkiCatalogPage, ArkiStaffOrdersPage, MesInformations } from '@/pages/arki-family';
import { Guides, GuideDetail, GuideNew, GuideEdit } from '@/pages/guides';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15000, refetchOnWindowFocus: true } },
});

function Router() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/cluster" component={Cluster} />
          <Route path="/maps" component={MapsPage} />
          <Route path="/maps/:slug" component={MapDetail} />
          <Route path="/mods" component={Mods} />
          <Route path="/evenements" component={Events} />
          <Route path="/guides" component={Guides} />
          <Route path="/guides/nouveau" component={GuideNew} />
          <Route path="/guides/:id/modifier" component={GuideEdit} />
          <Route path="/guides/:id" component={GuideDetail} />
          <Route path="/shop" component={Shop} />
          <Route path="/dons" component={Dons} />
          <Route path="/tribus" component={Directory} />
          <Route path="/mon-espace" component={MySpace} />
          <Route path="/mes-informations" component={MesInformations} />
          <Route path="/catalogue-arkifamily" component={ArkiCatalogPage} />
          <Route path="/mes-dinos" component={MesDinos} />
          <Route path="/mes-dinos/catalogue" component={MesDinosCatalogue} />
          <Route path="/tribus/:id/gerer" component={Manage} />
          <Route path="/tribus/:id" component={TribePage} />
          <Route path="/mes-tribus" component={MyTribes} />
          <Route path="/creer" component={CreateTribe} />
          <Route path="/connexion" component={Login} />
          <Route path="/rejoindre" component={JoinCommunity} />
          <Route path="/administration/commandes" component={ArkiStaffOrdersPage} />
          <Route path="/administration" component={Admin} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <OwnerViewProvider><Router /></OwnerViewProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
