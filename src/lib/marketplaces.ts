export interface Marketplace {
  id: string
  code: string
  name: string
  country: string
  region: "eu" | "na" | "fe"
  flag: string
}

export const MARKETPLACES: Marketplace[] = [
  // Europe
  { id: "A13V1IB3VIYZZH", code: "FR", name: "Amazon.fr", country: "France", region: "eu", flag: "🇫🇷" },
  { id: "A1PA6795UKMFR9", code: "DE", name: "Amazon.de", country: "Allemagne", region: "eu", flag: "🇩🇪" },
  { id: "A1RKKUPIHCS9HS", code: "ES", name: "Amazon.es", country: "Espagne", region: "eu", flag: "🇪🇸" },
  { id: "APJ6JRA9NG5V4", code: "IT", name: "Amazon.it", country: "Italie", region: "eu", flag: "🇮🇹" },
  { id: "A1F83G8C2ARO7P", code: "UK", name: "Amazon.co.uk", country: "Royaume-Uni", region: "eu", flag: "🇬🇧" },
  { id: "A1805IZSGTT6HS", code: "NL", name: "Amazon.nl", country: "Pays-Bas", region: "eu", flag: "🇳🇱" },
  { id: "A2NODRKZP88ZB9", code: "SE", name: "Amazon.se", country: "Suède", region: "eu", flag: "🇸🇪" },
  { id: "A1C3SOZRARQ6R3", code: "PL", name: "Amazon.pl", country: "Pologne", region: "eu", flag: "🇵🇱" },
  { id: "ARBP9OOSHTCHU", code: "EG", name: "Amazon.eg", country: "Egypte", region: "eu", flag: "🇪🇬" },
  { id: "A33AVAJ2PDY3EV", code: "TR", name: "Amazon.com.tr", country: "Turquie", region: "eu", flag: "🇹🇷" },
  { id: "A17E79C6D8DWNP", code: "SA", name: "Amazon.sa", country: "Arabie Saoudite", region: "eu", flag: "🇸🇦" },
  { id: "A2VIGQ35RCS4UG", code: "AE", name: "Amazon.ae", country: "Emirats Arabes Unis", region: "eu", flag: "🇦🇪" },
  { id: "A21TJRUUN4KGV", code: "IN", name: "Amazon.in", country: "Inde", region: "eu", flag: "🇮🇳" },
  { id: "AMEN7PMS3EDWL", code: "BE", name: "Amazon.com.be", country: "Belgique", region: "eu", flag: "🇧🇪" },
  // North America
  { id: "ATVPDKIKX0DER", code: "US", name: "Amazon.com", country: "Etats-Unis", region: "na", flag: "🇺🇸" },
  { id: "A2EUQ1WTGCTBG2", code: "CA", name: "Amazon.ca", country: "Canada", region: "na", flag: "🇨🇦" },
  { id: "A1AM78C64UM0Y8", code: "MX", name: "Amazon.com.mx", country: "Mexique", region: "na", flag: "🇲🇽" },
  { id: "A2Q3Y263D00KWC", code: "BR", name: "Amazon.com.br", country: "Brésil", region: "na", flag: "🇧🇷" },
  // Far East
  { id: "A1VC38T7YXB528", code: "JP", name: "Amazon.co.jp", country: "Japon", region: "fe", flag: "🇯🇵" },
  { id: "A39IBJ37TRP1C6", code: "AU", name: "Amazon.com.au", country: "Australie", region: "fe", flag: "🇦🇺" },
  { id: "A19VAU5U5O7RUS", code: "SG", name: "Amazon.sg", country: "Singapour", region: "fe", flag: "🇸🇬" },
]

export function getMarketplaceById(id: string): Marketplace | undefined {
  return MARKETPLACES.find((m) => m.id === id)
}

export function getMarketplacesByRegion(region: "eu" | "na" | "fe"): Marketplace[] {
  return MARKETPLACES.filter((m) => m.region === region)
}
