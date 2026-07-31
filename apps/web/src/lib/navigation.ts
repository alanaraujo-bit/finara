import type { Icon } from "@phosphor-icons/react";
import {
  BankIcon,
  CalendarBlankIcon,
  CreditCardIcon,
  GearIcon,
  HandCoinsIcon,
  HouseIcon,
  PlugsConnectedIcon,
  ReceiptIcon,
  RepeatIcon,
  SquaresFourIcon,
  TrendDownIcon,
} from "@phosphor-icons/react/dist/ssr";

export type NavItem = {
  href: string;
  label: string;
  icon: Icon;
  /** Aparece na barra inferior do celular (espaco e' curto: no maximo 4). */
  mobile?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navigation: NavGroup[] = [
  {
    label: "Dia a dia",
    items: [
      { href: "/", label: "Visão geral", icon: HouseIcon, mobile: true },
      { href: "/lancamentos", label: "Lançamentos", icon: ReceiptIcon, mobile: true },
      { href: "/calendario", label: "Calendário", icon: CalendarBlankIcon, mobile: true },
    ],
  },
  {
    label: "Compromissos",
    items: [
      { href: "/cartoes", label: "Cartões e faturas", icon: CreditCardIcon },
      { href: "/assinaturas", label: "Assinaturas", icon: RepeatIcon },
      { href: "/dividas", label: "Dívidas", icon: TrendDownIcon },
      { href: "/a-receber", label: "A receber", icon: HandCoinsIcon },
    ],
  },
  {
    label: "Estrutura",
    items: [
      { href: "/contas", label: "Contas", icon: BankIcon },
      { href: "/categorias", label: "Categorias", icon: SquaresFourIcon },
      { href: "/conexoes", label: "Conexões", icon: PlugsConnectedIcon },
      { href: "/ajustes", label: "Ajustes", icon: GearIcon },
    ],
  },
];

export const allNavItems: NavItem[] = navigation.flatMap((g) => g.items);
export const mobileNavItems: NavItem[] = allNavItems.filter((i) => i.mobile);
