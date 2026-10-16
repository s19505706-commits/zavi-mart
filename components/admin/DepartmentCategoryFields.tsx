"use client";

import { useEffect, useState } from "react";

type DepartmentOption = { id: string; name: string };
type CategoryOption = { id: string; name: string; departmentId: string };
type Classification = { departmentId: string; categoryId: string; categoryName: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default function DepartmentCategoryFields({
  departmentId,
  categoryId,
  onChange,
  className
}: {
  departmentId: string;
  categoryId: string;
  onChange: (classification: Classification) => void;
  className?: string;
}) {
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/departments", { cache: "no-store" }),
      fetch("/api/categories", { cache: "no-store" })
    ]).then(async ([departmentResponse, categoryResponse]) => {
      const [departmentResult, categoryResult]: unknown[] = await Promise.all([
        departmentResponse.json(),
        categoryResponse.json()
      ]);
      if (!departmentResponse.ok || !categoryResponse.ok ||
          !isRecord(departmentResult) || !Array.isArray(departmentResult.departments) ||
          !isRecord(categoryResult) || !Array.isArray(categoryResult.categories)) {
        throw new Error("Could not load departments and categories.");
      }
      const loadedDepartments = departmentResult.departments.flatMap((item): DepartmentOption[] =>
        isRecord(item) && typeof item.id === "string" && typeof item.name === "string"
          ? [{ id: item.id, name: item.name }]
          : []
      );
      const loadedCategories = categoryResult.categories.flatMap((item): CategoryOption[] =>
        isRecord(item) && typeof item.id === "string" && typeof item.name === "string" &&
          typeof item.departmentId === "string"
          ? [{ id: item.id, name: item.name, departmentId: item.departmentId }]
          : []
      );
      if (!cancelled) {
        setDepartments(loadedDepartments);
        setCategories(loadedCategories);
      }
    }).catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load classification options.");
    });
    return () => { cancelled = true; };
  }, []);

  const filteredCategories = categories.filter((category) => category.departmentId === departmentId);

  return (
    <>
      <label className={className}>
        Department
        <select
          value={departmentId}
          onChange={(event) => onChange({ departmentId: event.target.value, categoryId: "", categoryName: "" })}
          required={departments.length > 0}
          disabled={departments.length === 0}
        >
          <option value="" disabled>
            {departments.length ? "Select a department" : "No departments available"}
          </option>
          {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </select>
        {departments.length === 0 && (
          <span role="status">Add a department before assigning product categories.</span>
        )}
      </label>
      <label className={className}>
        Category
        <select
          value={categoryId}
          onChange={(event) => {
            const category = filteredCategories.find((item) => item.id === event.target.value);
            onChange({ departmentId, categoryId: event.target.value, categoryName: category?.name ?? "" });
          }}
          required={departments.length > 0}
          disabled={!departmentId || filteredCategories.length === 0}
        >
          <option value="" disabled>
            {!departmentId
              ? "Select a department first"
              : filteredCategories.length
                ? "Select a category"
                : "No categories available"}
          </option>
          {filteredCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        {departmentId && filteredCategories.length === 0 && (
          <span role="status">Add a category under this department before assigning products.</span>
        )}
        {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
      </label>
    </>
  );
}
