export function getValidSectorId(
  staffSectorId: string | null | undefined,
  targetUnit: string | null | undefined,
  proSectors: any[]
): string | null {
  if (!staffSectorId || !targetUnit) return null;
  
  const sector = proSectors.find(s => String(s.id) === String(staffSectorId));
  if (sector && sector.unit === targetUnit) {
    return String(sector.id);
  }
  
  return null;
}
