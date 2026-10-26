import { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type PickablePlayer = { id: string; full_name: string | null; email?: string | null };

// Searchable player picker for staff: type part of a name (or email) instead of scrolling the whole squad.
export function PlayerPicker({ players, value, onChange, placeholder = "Choose player", label = "Choose player", className }: {
  players: PickablePlayer[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = players.find((p) => p.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-label={label} className={cn("justify-between font-normal", !selected && "text-muted-foreground", className)}>
          <span className="truncate">{selected ? (selected.full_name ?? selected.email ?? "Player") : placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by name" />
          <CommandList>
            <CommandEmpty><span className="flex items-center justify-center gap-2 text-muted-foreground"><Search className="size-4" />No player found.</span></CommandEmpty>
            <CommandGroup>
              {players.map((p) => {
                const name = p.full_name ?? p.email ?? "Player";
                return (
                  <CommandItem key={p.id} value={`${name} ${p.email ?? ""}`} onSelect={() => { onChange(p.id); setOpen(false); }}>
                    <Check className={cn("size-4", p.id === value ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    {p.email && p.full_name && <span className="truncate text-xs text-muted-foreground">{p.email}</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
