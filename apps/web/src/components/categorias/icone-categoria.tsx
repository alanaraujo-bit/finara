"use client";

import {
  AirplaneIcon,
  BabyIcon,
  BankIcon,
  BarbellIcon,
  BasketIcon,
  BookIcon,
  BriefcaseIcon,
  BuildingsIcon,
  BusIcon,
  CarIcon,
  ChartLineUpIcon,
  CoffeeIcon,
  CreditCardIcon,
  DotsThreeCircleIcon,
  DropIcon,
  FilmSlateIcon,
  ForkKnifeIcon,
  GameControllerIcon,
  GasPumpIcon,
  GiftIcon,
  GraduationCapIcon,
  HandCoinsIcon,
  HeartbeatIcon,
  HouseIcon,
  type Icon,
  LightningIcon,
  MoneyIcon,
  MusicNotesIcon,
  PawPrintIcon,
  PhoneIcon,
  PiggyBankIcon,
  PillIcon,
  ReceiptIcon,
  RepeatIcon,
  ScissorsIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  SparkleIcon,
  TagIcon,
  TShirtIcon,
  UsersIcon,
  WifiHighIcon,
  WrenchIcon,
} from "@phosphor-icons/react";

/**
 * Resolve o nome guardado no banco para o componente do Phosphor.
 *
 * As chaves espelham `ICONES_CATEGORIA`. O mapa e' explicito de proposito:
 * import dinamico por nome traria o pacote inteiro para o bundle.
 */
const MAPA: Record<string, Icon> = {
  House: HouseIcon,
  Buildings: BuildingsIcon,
  Lightning: LightningIcon,
  Drop: DropIcon,
  WifiHigh: WifiHighIcon,
  Phone: PhoneIcon,
  ForkKnife: ForkKnifeIcon,
  Coffee: CoffeeIcon,
  ShoppingCart: ShoppingCartIcon,
  Basket: BasketIcon,
  Car: CarIcon,
  Bus: BusIcon,
  GasPump: GasPumpIcon,
  Airplane: AirplaneIcon,
  Heartbeat: HeartbeatIcon,
  Pill: PillIcon,
  Barbell: BarbellIcon,
  Scissors: ScissorsIcon,
  GraduationCap: GraduationCapIcon,
  Book: BookIcon,
  FilmSlate: FilmSlateIcon,
  GameController: GameControllerIcon,
  MusicNotes: MusicNotesIcon,
  ShoppingBag: ShoppingBagIcon,
  TShirt: TShirtIcon,
  PawPrint: PawPrintIcon,
  Baby: BabyIcon,
  Users: UsersIcon,
  Gift: GiftIcon,
  Money: MoneyIcon,
  PiggyBank: PiggyBankIcon,
  HandCoins: HandCoinsIcon,
  ChartLineUp: ChartLineUpIcon,
  Briefcase: BriefcaseIcon,
  Bank: BankIcon,
  CreditCard: CreditCardIcon,
  Receipt: ReceiptIcon,
  Repeat: RepeatIcon,
  Wrench: WrenchIcon,
  Sparkle: SparkleIcon,
  Tag: TagIcon,
  DotsThreeCircle: DotsThreeCircleIcon,
};

export function IconeCategoria({
  nome,
  size = 18,
  weight = "duotone",
}: {
  nome: string;
  size?: number;
  weight?: "duotone" | "regular" | "bold" | "fill";
}) {
  // Nome desconhecido (icone removido da lista depois de gravado) cai na
  // etiqueta generica em vez de quebrar a tela.
  const Componente = MAPA[nome] ?? TagIcon;
  return <Componente size={size} weight={weight} />;
}
