"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api/client";
import type { BoxTag, Location } from "./types";

/** Loads one box plus the locations list, with a reload function for after changes. */
export function useBoxTag(id: string) {
  const [box, setBox] = useState<BoxTag | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [tag, locs] = await Promise.all([api.getBoxTag(id), api.listLocations()]);
    setBox(tag);
    setLocations(locs);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const locationName = (locationId: string | null) =>
    locations.find((l) => l.location_id === locationId)?.location_name ?? null;

  return { box, setBox, locations, locationName, loading, reload };
}
