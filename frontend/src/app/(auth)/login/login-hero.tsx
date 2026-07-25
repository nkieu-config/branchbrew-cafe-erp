import type { LucideIcon } from "lucide-react";
import { ChefHat, Package, ShoppingCart, Users } from "lucide-react";
import {
  authHeroCardClassName,
  authHeroDividerClassName,
  authHeroEyebrowClassName,
  authHeroModuleGlyphClassName,
  authHeroModuleIconClassName,
  authHeroModuleLabelClassName,
  authHeroModuleWellClassName,
  authHeroSectionLabelClassName,
  authHeroStatClassName,
  authHeroStatLabelClassName,
  authHeroStatsGridClassName,
  authHeroStatValueClassName,
  authHeroTextClassName,
  authHeroTitleClassName,
} from "@/lib/theme/auth";
import { cn } from "@/lib/utils";

export const LOGIN_HERO_EYEBROW = "Multi-branch cafe ERP";

export const LOGIN_HERO_HEADLINE = "One platform for cafe operations";

export const LOGIN_HERO_BODY =
  "POS, inventory, kitchen production, and payroll — unified for every branch.";

export const LOGIN_HERO_STATS = [
  { value: "23", label: "Modules" },
  { value: "131", label: "Endpoints" },
  { value: "464", label: "Tests" },
] as const;

type HeroModule = {
  label: string;
  icon: LucideIcon;
};

const HERO_MODULES: HeroModule[] = [
  { label: "POS", icon: ShoppingCart },
  { label: "Inventory", icon: Package },
  { label: "HR", icon: Users },
  { label: "Kitchen", icon: ChefHat },
];

function HeroModuleIcons({ className }: { className?: string }) {
  return (
    <div className={className}>
      <p className={cn(authHeroSectionLabelClassName(), "mb-3")}>Core modules</p>
      <div className="grid grid-cols-4 gap-2">
        {HERO_MODULES.map((module) => {
          const Icon = module.icon;
          return (
            <div key={module.label} className={authHeroModuleIconClassName()}>
              <div className={authHeroModuleWellClassName()}>
                <Icon className={authHeroModuleGlyphClassName()} aria-hidden />
              </div>
              <span className={authHeroModuleLabelClassName()}>{module.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeroStats({ className }: { className?: string }) {
  return (
    <div className={className}>
      <p className={cn(authHeroSectionLabelClassName(), "mb-3")}>At a glance</p>
      <div className={authHeroStatsGridClassName()}>
        {LOGIN_HERO_STATS.map((stat) => (
          <div key={stat.label} className={authHeroStatClassName()}>
            <div className={authHeroStatValueClassName()}>{stat.value}</div>
            <div className={authHeroStatLabelClassName()}>{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LoginHeroCard({ className }: { className?: string }) {
  return (
    <div className={authHeroCardClassName(className)}>
      <div className="text-center">
        <span className={authHeroEyebrowClassName()}>{LOGIN_HERO_EYEBROW}</span>
        <h2 className={authHeroTitleClassName()}>{LOGIN_HERO_HEADLINE}</h2>
        <p className={authHeroTextClassName()}>{LOGIN_HERO_BODY}</p>
      </div>

      <HeroModuleIcons className="mt-7" />
      <div className={authHeroDividerClassName()} />
      <HeroStats />
    </div>
  );
}
