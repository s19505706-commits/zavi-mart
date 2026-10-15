"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import AdminCard from "../../../components/admin/AdminCard";
import AdminPageHeader from "../../../components/admin/AdminPageHeader";
import AdminTable from "../../../components/admin/AdminTable";
import styles from "./departments.module.css";

type Department = {
  id: string;
  name: string;
  slug: string;
  image: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  totalCategories: number;
  totalProducts: number;
};

type Category = Omit<Department, "totalCategories" | "totalProducts"> & {
  departmentId: string;
  productsCount: number;
};

type FormState = {
  name: string;
  slug: string;
  image: string;
  description: string;
  departmentId: string;
  isActive: boolean;
  sortOrder: number;
};

type RecordValue = Record<string, unknown>;
type EntityType = "department" | "category";
type Tab = "departments" | "categories";

const EMPTY_FORM: FormState = {
  name: "",
  slug: "",
  image: "",
  description: "",
  departmentId: "",
  isActive: true,
  sortOrder: 0
};

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function slugify(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function parseDepartments(value: unknown): Department[] {
  if (!isRecord(value) || !Array.isArray(value.departments)) return [];
  return value.departments.flatMap((entry): Department[] => {
    if (!isRecord(entry) || typeof entry.id !== "string" ||
        typeof entry.name !== "string" || typeof entry.slug !== "string" ||
        typeof entry.isActive !== "boolean" || typeof entry.sortOrder !== "number") return [];
    return [{
      id: entry.id,
      name: entry.name,
      slug: entry.slug,
      image: typeof entry.image === "string" ? entry.image : "",
      description: typeof entry.description === "string" ? entry.description : "",
      isActive: entry.isActive,
      sortOrder: entry.sortOrder,
      totalCategories: typeof entry.totalCategories === "number" ? entry.totalCategories : 0,
      totalProducts: typeof entry.totalProducts === "number" ? entry.totalProducts : 0
    }];
  });
}

function parseCategories(value: unknown): Category[] {
  if (!isRecord(value) || !Array.isArray(value.categories)) return [];
  return value.categories.flatMap((entry): Category[] => {
    if (!isRecord(entry) || typeof entry.id !== "string" ||
        typeof entry.name !== "string" || typeof entry.slug !== "string" ||
        typeof entry.departmentId !== "string" || typeof entry.isActive !== "boolean" ||
        typeof entry.sortOrder !== "number") return [];
    return [{
      id: entry.id,
      name: entry.name,
      slug: entry.slug,
      departmentId: entry.departmentId,
      image: typeof entry.image === "string" ? entry.image : "",
      description: typeof entry.description === "string" ? entry.description : "",
      isActive: entry.isActive,
      sortOrder: entry.sortOrder,
      productsCount: typeof entry.productsCount === "number" ? entry.productsCount : 0
    }];
  });
}

function formatDateInput(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [adminKey, setAdminKey] = useState("");
  const [tab, setTab] = useState<Tab>("departments");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [entityType, setEntityType] = useState<EntityType>("department");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const loadAll = useCallback(async (key: string) => {
    setLoading(true);
    setError("");
    try {
      const headers = { "x-admin-key": key };
      const [departmentResponse, categoryResponse] = await Promise.all([
        fetch("/api/admin/departments", { cache: "no-store", headers }),
        fetch("/api/admin/categories", { cache: "no-store", headers })
      ]);
      const [departmentResult, categoryResult]: unknown[] = await Promise.all([
        departmentResponse.json(),
        categoryResponse.json()
      ]);
      if (!departmentResponse.ok || !isRecord(departmentResult)) {
        throw new Error(isRecord(departmentResult) && typeof departmentResult.error === "string"
          ? departmentResult.error : "Could not load departments.");
      }
      if (!categoryResponse.ok || !isRecord(categoryResult)) {
        throw new Error(isRecord(categoryResult) && typeof categoryResult.error === "string"
          ? categoryResult.error : "Could not load categories.");
      }
      setDepartments(parseDepartments(departmentResult));
      setCategories(parseCategories(categoryResult));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load departments and categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "categories") setTab("categories");
    const savedKey = sessionStorage.getItem("zavimart-admin-key")?.trim();
    if (savedKey) setAdminKey(savedKey);
    void loadAll(savedKey || "");
  }, [loadAll]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleDepartments = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return departments.filter((department) =>
      `${department.name} ${department.slug} ${department.description}`.toLocaleLowerCase().includes(query)
    );
  }, [departments, search]);
  const visibleCategories = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return categories.filter((category) =>
      (!departmentFilter || category.departmentId === departmentFilter) &&
      `${category.name} ${category.slug} ${category.description} ${departments.find((entry) => entry.id === category.departmentId)?.name ?? ""}`
        .toLocaleLowerCase().includes(query)
    );
  }, [categories, departmentFilter, departments, search]);

  function openCreate(type: EntityType) {
    setEntityType(type);
    setEditingId(null);
    setSlugEdited(false);
    setForm({
      ...EMPTY_FORM,
      departmentId: type === "category" ? departmentFilter || departments[0]?.id || "" : ""
    });
    setError("");
    setModalOpen(true);
  }

  function openEdit(type: EntityType, item: Department | Category) {
    setEntityType(type);
    setEditingId(item.id);
    setSlugEdited(true);
    setForm({
      name: item.name,
      slug: item.slug,
      image: item.image,
      description: item.description,
      departmentId: type === "category" ? (item as Category).departmentId : "",
      isActive: item.isActive,
      sortOrder: item.sortOrder
    });
    setError("");
    setModalOpen(true);
  }

  function handleNameChange(name: string) {
    setForm((current) => ({ ...current, name, ...(!slugEdited ? { slug: slugify(name) } : {}) }));
  }

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 750_000) {
      setError("Choose an image smaller than 750 KB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setError("Could not read the selected image.");
        return;
      }
      setForm((current) => ({ ...current, image: reader.result as string }));
      setError("");
    };
    reader.onerror = () => setError("Could not read the selected image.");
    reader.readAsDataURL(file);
  }

  async function submitEntity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const endpoint = entityType === "department" ? "/api/admin/departments" : "/api/admin/categories";
      const response = await fetch(editingId ? `${endpoint}/${encodeURIComponent(editingId)}` : endpoint, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey.trim() || "" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          image: form.image,
          description: form.description,
          ...(entityType === "category" ? { departmentId: form.departmentId } : {}),
          isActive: form.isActive,
          sortOrder: form.sortOrder
        })
      });
      const result: unknown = await response.json();
      if (!response.ok || !isRecord(result)) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error : `Could not save this ${entityType}.`);
      }
      setModalOpen(false);
      setToast(`${entityType === "department" ? "Department" : "Category"} ${editingId ? "updated" : "added"}`);
      await loadAll(adminKey.trim() || "");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : `Could not save this ${entityType}.`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntity(type: EntityType, id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? ${type === "department" ? "Products must be moved first." : "Products must be moved first."}`)) return;
    setError("");
    const endpoint = type === "department" ? "/api/admin/departments" : "/api/admin/categories";
    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "x-admin-key": adminKey.trim() || "" }
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error : `Could not delete this ${type}.`);
      }
      setToast(`${type === "department" ? "Department" : "Category"} deleted`);
      await loadAll(adminKey.trim() || "");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : `Could not delete this ${type}.`);
    }
  }

  function showDepartmentCategories(departmentId: string) {
    setDepartmentFilter(departmentId);
    setSearch("");
    setTab("categories");
  }

  return (
    <main className={`${styles.page} admin-content`}>
      <AdminPageHeader
        title="Departments & Categories"
        count={tab === "departments" ? visibleDepartments.length : visibleCategories.length}
        description="Organize products into parent departments and categories."
        searchValue={search}
        searchPlaceholder={`Search ${tab}...`}
        onSearchChange={setSearch}
        action={
          <button className={styles.primaryButton} type="button" onClick={() => openCreate(tab === "departments" ? "department" : "category")}>
            + Add {tab === "departments" ? "Department" : "Category"}
          </button>
        }
      />

      <label className={styles.adminKey}>
        Admin API key
        <input
          type="password"
          value={adminKey}
          onChange={(event) => {
            setAdminKey(event.target.value);
            sessionStorage.setItem("zavimart-admin-key", event.target.value);
          }}
          onBlur={() => void loadAll(adminKey.trim() || "")}
          autoComplete="current-password"
        />
      </label>

      <div className={styles.tabs} role="tablist" aria-label="Department and category management">
        <button type="button" role="tab" aria-selected={tab === "departments"} className={tab === "departments" ? styles.tabActive : styles.tab} onClick={() => { setTab("departments"); setSearch(""); }}>Departments</button>
        <button type="button" role="tab" aria-selected={tab === "categories"} className={tab === "categories" ? styles.tabActive : styles.tab} onClick={() => { setTab("categories"); setSearch(""); }}>Categories</button>
      </div>

      <AdminCard as="section" className={styles.panel} aria-labelledby="catalogHeading">
        <div className={styles.panelHeading}>
          <h2 id="catalogHeading">{tab === "departments" ? "Departments (Parent)" : "Categories (Child)"}</h2>
          <span>{tab === "departments" ? visibleDepartments.length : visibleCategories.length} entries</span>
        </div>
        <div className={styles.filters}>
          {tab === "categories" && (
            <label>
              Filter by Department
              <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
                <option value="">All Departments</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
            </label>
          )}
        </div>
        {error && !modalOpen && <p className={styles.error} role="alert">{error}</p>}
        {loading ? <p className={styles.empty}>Loading {tab}...</p> : tab === "departments" ? (
          visibleDepartments.length ? (
            <AdminTable className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Image</th><th>Name</th><th>Slug</th><th>Total Categories</th><th>Total Products</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>{visibleDepartments.map((department) => (
                  <tr key={department.id}>
                    <td>{department.image ? <img className={styles.categoryImage} src={department.image} alt="" /> : <span className={styles.imagePlaceholder}>—</span>}</td>
                    <td><strong>{department.name}</strong>{department.description && <small>{department.description}</small>}</td>
                    <td><code>{department.slug}</code></td>
                    <td>{department.totalCategories}</td>
                    <td>{department.totalProducts}</td>
                    <td><span className={department.isActive ? styles.statusActive : styles.statusInactive}>{department.isActive ? "Active" : "Inactive"}</span></td>
                    <td><div className={styles.rowActions}>
                      <button type="button" onClick={() => openEdit("department", department)}>Edit</button>
                      <button type="button" onClick={() => showDepartmentCategories(department.id)}>View Categories</button>
                      <button type="button" className={styles.deleteButton} onClick={() => void deleteEntity("department", department.id, department.name)}>Delete</button>
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </AdminTable>
          ) : <p className={styles.empty}>No departments found.</p>
        ) : visibleCategories.length ? (
          <AdminTable className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Image</th><th>Category Name</th><th>Slug</th><th>Parent Department</th><th>Products Count</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{visibleCategories.map((category) => (
                <tr key={category.id}>
                  <td>{category.image ? <img className={styles.categoryImage} src={category.image} alt="" /> : <span className={styles.imagePlaceholder}>—</span>}</td>
                  <td><strong>{category.name}</strong>{category.description && <small>{category.description}</small>}</td>
                  <td><code>{category.slug}</code></td>
                  <td><span className={styles.departmentBadge}>{departments.find((entry) => entry.id === category.departmentId)?.name ?? "Department"}</span></td>
                  <td>{category.productsCount}</td>
                  <td><span className={category.isActive ? styles.statusActive : styles.statusInactive}>{category.isActive ? "Active" : "Inactive"}</span></td>
                  <td><div className={styles.rowActions}>
                    <button type="button" onClick={() => openEdit("category", category)}>Edit</button>
                    <button type="button" className={styles.deleteButton} onClick={() => void deleteEntity("category", category.id, category.name)}>Delete</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </AdminTable>
        ) : <p className={styles.empty}>No categories yet. Add a child category under a department.</p>}
      </AdminCard>

      {modalOpen && (
        <div className={styles.modalBackdrop} onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setModalOpen(false);
        }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="entityModalHeading">
            <header className={styles.modalHeading}>
              <h2 id="entityModalHeading">{editingId ? "Edit" : "Add"} {entityType === "department" ? "Department" : "Category"}</h2>
              <button type="button" aria-label="Close dialog" onClick={() => setModalOpen(false)} disabled={saving}>×</button>
            </header>
            <form className={styles.form} onSubmit={submitEntity}>
              {entityType === "category" && (
                <label className={styles.fullWidth}>
                  Department *
                  <select required value={form.departmentId} onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))}>
                    <option value="">Select department</option>
                    {departments.filter((department) => department.isActive || department.id === form.departmentId)
                      .map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </select>
                </label>
              )}
              <label>
                {entityType === "department" ? "Department Name *" : "Category Name *"}
                <input required maxLength={100} value={form.name} onChange={(event) => handleNameChange(event.target.value)} placeholder={entityType === "department" ? "Beauty" : "Face Wash"} />
              </label>
              <label>
                Slug *
                <input required maxLength={120} value={form.slug} onChange={(event) => { setSlugEdited(true); setForm((current) => ({ ...current, slug: slugify(event.target.value) })); }} />
              </label>
              <label className={styles.fullWidth}>
                Image URL or upload
                <input type="url" value={form.image.startsWith("data:") ? "" : form.image} onChange={(event) => setForm((current) => ({ ...current, image: event.target.value }))} placeholder="https://example.com/image.jpg" />
                <input type="file" accept="image/*" onChange={handleImageUpload} />
                {form.image && <img className={styles.imagePreview} src={form.image} alt="Preview" />}
              </label>
              <label className={styles.fullWidth}>
                Description
                <textarea rows={3} maxLength={1000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
              </label>
              <label>
                Sort Order
                <input type="number" min="0" max="100000" step="1" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))} />
              </label>
              <label className={styles.toggle}>
                <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
                Active
              </label>
              {error && <p className={`${styles.error} ${styles.fullWidth}`} role="alert">{error}</p>}
              <div className={`${styles.formActions} ${styles.fullWidth}`}>
                <button type="button" className={styles.secondaryButton} onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
                <button type="submit" className={styles.primaryButton} disabled={saving || (entityType === "category" && !form.departmentId)}>{saving ? "Saving..." : editingId ? "Save Changes" : `Add ${entityType === "department" ? "Department" : "Category"}`}</button>
              </div>
            </form>
          </section>
        </div>
      )}
      {toast && <div className={styles.toast} role="status" aria-live="polite">{toast}</div>}
    </main>
  );
}
