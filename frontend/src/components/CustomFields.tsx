'use client';

import { useCallback, useEffect, useState } from 'react';
import { customFields as customFieldsApi } from '@/lib/api';

// ─── Types ──────────────────────────────────────────
export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea';

export type CustomFieldDefinition = {
  name: string;
  type: CustomFieldType;
  required: boolean;
  options?: string[];
};

export type CustomFieldTemplate = {
  id: string;
  name: string;
  entityType: string;
  fields: CustomFieldDefinition[];
  isDefault: boolean;
};

type CustomFieldsProps = {
  entityType: 'client' | 'project' | 'invoice' | 'expense';
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  templates?: CustomFieldTemplate[];
};

// ─── Icons ──────────────────────────────────────────
function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}

function IconSave() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─── Field type labels ──────────────────────────────
const FIELD_TYPE_LABELS: Record<CustomFieldType, { he: string; en: string }> = {
  text: { he: 'טקסט', en: 'Text' },
  number: { he: 'מספר', en: 'Number' },
  date: { he: 'תאריך', en: 'Date' },
  select: { he: 'בחירה', en: 'Select' },
  checkbox: { he: 'תיבת סימון', en: 'Checkbox' },
  textarea: { he: 'טקסט ארוך', en: 'Textarea' },
};

const FIELD_TYPES: CustomFieldType[] = ['text', 'number', 'date', 'select', 'checkbox', 'textarea'];

// ─── Component ──────────────────────────────────────
export default function CustomFields({ entityType, value, onChange, templates: propTemplates }: CustomFieldsProps) {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templates, setTemplates] = useState<CustomFieldTemplate[]>(propTemplates || []);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [editingOptions, setEditingOptions] = useState<number | null>(null);
  const [optionsInput, setOptionsInput] = useState('');

  // Fetch templates on mount
  const fetchTemplates = useCallback(async () => {
    if (propTemplates) return;
    setLoadingTemplates(true);
    try {
      const result = await customFieldsApi.getTemplates(entityType);
      setTemplates(result as unknown as CustomFieldTemplate[]);
    } catch {
      // silently fail
    } finally {
      setLoadingTemplates(false);
    }
  }, [entityType, propTemplates]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Sync fields from value on initial load
  useEffect(() => {
    if (value && value._fieldDefinitions && Array.isArray(value._fieldDefinitions)) {
      setFields(value._fieldDefinitions);
    }
  }, []);

  // Update parent value whenever fields or their values change
  function updateValue(updatedFields: CustomFieldDefinition[], updatedValues?: Record<string, any>) {
    const vals = updatedValues || value || {};
    onChange({
      ...vals,
      _fieldDefinitions: updatedFields,
    });
  }

  function handleFieldValueChange(fieldName: string, fieldValue: any) {
    const newValue = { ...value, [fieldName]: fieldValue };
    onChange(newValue);
  }

  function addField(type: CustomFieldType) {
    const newField: CustomFieldDefinition = {
      name: '',
      type,
      required: false,
      options: type === 'select' ? [] : undefined,
    };
    const updatedFields = [...fields, newField];
    setFields(updatedFields);
    updateValue(updatedFields);
    setShowAddMenu(false);
  }

  function removeField(index: number) {
    const fieldName = fields[index].name;
    const updatedFields = fields.filter((_, i) => i !== index);
    setFields(updatedFields);
    // Remove the value for the removed field
    const newValue = { ...value };
    if (fieldName) {
      delete newValue[fieldName];
    }
    newValue._fieldDefinitions = updatedFields;
    onChange(newValue);
  }

  function updateFieldName(index: number, newName: string) {
    const oldName = fields[index].name;
    const updatedFields = [...fields];
    updatedFields[index] = { ...updatedFields[index], name: newName };
    setFields(updatedFields);

    // Move value from old key to new key
    const newValue = { ...value };
    if (oldName && oldName !== newName) {
      const oldVal = newValue[oldName];
      delete newValue[oldName];
      if (newName) {
        newValue[newName] = oldVal;
      }
    }
    newValue._fieldDefinitions = updatedFields;
    onChange(newValue);
  }

  function updateFieldType(index: number, newType: CustomFieldType) {
    const updatedFields = [...fields];
    updatedFields[index] = {
      ...updatedFields[index],
      type: newType,
      options: newType === 'select' ? (updatedFields[index].options || []) : undefined,
    };
    setFields(updatedFields);
    updateValue(updatedFields);
  }

  function updateFieldOptions(index: number, options: string[]) {
    const updatedFields = [...fields];
    updatedFields[index] = { ...updatedFields[index], options };
    setFields(updatedFields);
    updateValue(updatedFields);
  }

  async function handleSaveTemplate() {
    if (!templateName.trim() || fields.length === 0) return;
    setSavingTemplate(true);
    try {
      await customFieldsApi.saveTemplate({
        name: templateName.trim(),
        entityType,
        fields: fields.filter((f) => f.name.trim()),
      });
      setShowSaveTemplate(false);
      setTemplateName('');
      fetchTemplates();
    } catch {
      // silently fail
    } finally {
      setSavingTemplate(false);
    }
  }

  function loadTemplate(template: CustomFieldTemplate) {
    setFields(template.fields);
    const newValue: Record<string, any> = { _fieldDefinitions: template.fields };
    // Initialize default values for each field
    template.fields.forEach((f) => {
      if (f.type === 'checkbox') {
        newValue[f.name] = false;
      } else if (f.type === 'number') {
        newValue[f.name] = '';
      } else {
        newValue[f.name] = '';
      }
    });
    onChange(newValue);
  }

  function handleSaveOptions(index: number) {
    const options = optionsInput.split('\n').map((o) => o.trim()).filter(Boolean);
    updateFieldOptions(index, options);
    setEditingOptions(null);
    setOptionsInput('');
  }

  // ─── Render ─────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold">
          {'\u05E9\u05D3\u05D5\u05EA \u05DE\u05D5\u05EA\u05D0\u05DE\u05D9\u05DD \u05D0\u05D9\u05E9\u05D9\u05EA'} {/* שדות מותאמים אישית */}
        </label>
        <div className="flex items-center gap-2">
          {/* Load Template dropdown */}
          {templates.length > 0 && (
            <div className="relative">
              <select
                className="input-sm text-xs pe-6"
                defaultValue=""
                onChange={(e) => {
                  const tmpl = templates.find((t) => t.id === e.target.value);
                  if (tmpl) loadTemplate(tmpl);
                  e.target.value = '';
                }}
              >
                <option value="" disabled>
                  {'\u05D8\u05E2\u05DF \u05D8\u05DE\u05E4\u05DC\u05D8'} {/* טען טמפלט */}
                </option>
                {templates.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    {tmpl.name}
                    {tmpl.isDefault ? ' *' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Existing field inputs */}
      {fields.length > 0 && (
        <div className="space-y-3 border border-[var(--border)] rounded-xl p-3">
          {fields.map((field, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center gap-2">
                {/* Field name input */}
                <input
                  className="input-sm flex-1"
                  value={field.name}
                  onChange={(e) => updateFieldName(index, e.target.value)}
                  placeholder={'\u05E9\u05DD \u05D4\u05E9\u05D3\u05D4'} /* שם השדה */
                />
                {/* Field type selector */}
                <select
                  className="input-sm w-auto text-xs"
                  value={field.type}
                  onChange={(e) => updateFieldType(index, e.target.value as CustomFieldType)}
                >
                  {FIELD_TYPES.map((ft) => (
                    <option key={ft} value={ft}>{FIELD_TYPE_LABELS[ft].he}</option>
                  ))}
                </select>
                {/* Options editor button for select fields */}
                {field.type === 'select' && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingOptions(index);
                      setOptionsInput((field.options || []).join('\n'));
                    }}
                    className="px-2 py-1 text-xs rounded-lg border border-[var(--border)] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    {'\u05D0\u05E4\u05E9\u05E8\u05D5\u05D9\u05D5\u05EA'} ({(field.options || []).length}) {/* אפשרויות */}
                  </button>
                )}
                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeField(index)}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 transition-colors"
                >
                  <IconTrash />
                </button>
              </div>

              {/* Field value input */}
              {field.name && (
                <div className="ps-2">
                  {field.type === 'text' && (
                    <input
                      className="input-sm w-full"
                      value={value[field.name] || ''}
                      onChange={(e) => handleFieldValueChange(field.name, e.target.value)}
                      placeholder={field.name}
                    />
                  )}
                  {field.type === 'number' && (
                    <input
                      type="number"
                      className="input-sm w-full"
                      value={value[field.name] || ''}
                      onChange={(e) => handleFieldValueChange(field.name, e.target.value)}
                      placeholder={field.name}
                    />
                  )}
                  {field.type === 'date' && (
                    <input
                      type="date"
                      className="input-sm w-full"
                      value={value[field.name] || ''}
                      onChange={(e) => handleFieldValueChange(field.name, e.target.value)}
                    />
                  )}
                  {field.type === 'select' && (
                    <select
                      className="input-sm w-full"
                      value={value[field.name] || ''}
                      onChange={(e) => handleFieldValueChange(field.name, e.target.value)}
                    >
                      <option value="">{'\u05D1\u05D7\u05E8'}...</option> {/* בחר... */}
                      {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                  {field.type === 'checkbox' && (
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!value[field.name]}
                        onChange={(e) => handleFieldValueChange(field.name, e.target.checked)}
                        className="rounded"
                      />
                      <span>{field.name}</span>
                    </label>
                  )}
                  {field.type === 'textarea' && (
                    <textarea
                      className="input-sm w-full h-16 resize-none"
                      value={value[field.name] || ''}
                      onChange={(e) => handleFieldValueChange(field.name, e.target.value)}
                      placeholder={field.name}
                    />
                  )}
                </div>
              )}

              {/* Options editor modal for select fields */}
              {editingOptions === index && (
                <div className="p-3 rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary-700 dark:text-primary-300">
                      {'\u05E2\u05E8\u05D9\u05DB\u05EA \u05D0\u05E4\u05E9\u05E8\u05D5\u05D9\u05D5\u05EA'} {/* עריכת אפשרויות */}
                    </span>
                    <button type="button" onClick={() => setEditingOptions(null)} className="text-slate-400 hover:text-slate-600">
                      <IconClose />
                    </button>
                  </div>
                  <textarea
                    className="input-sm w-full h-24 resize-none text-xs"
                    value={optionsInput}
                    onChange={(e) => setOptionsInput(e.target.value)}
                    placeholder={'\u05D0\u05E4\u05E9\u05E8\u05D5\u05EA \u05D0\u05D7\u05EA \u05D1\u05DB\u05DC \u05E9\u05D5\u05E8\u05D4'} /* אפשרות אחת בכל שורה */
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveOptions(index)}
                    className="btn-primary text-xs py-1.5 px-3"
                  >
                    {'\u05E9\u05DE\u05D5\u05E8'} {/* שמור */}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Field & Save Template buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Add Field dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-primary-600 dark:text-primary-400"
          >
            <IconPlus />
            {'\u05D4\u05D5\u05E1\u05E3 \u05E9\u05D3\u05D4'} {/* הוסף שדה */}
            <IconChevronDown />
          </button>
          {showAddMenu && (
            <div className="absolute z-20 top-full mt-1 start-0 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg min-w-[160px] py-1">
              {FIELD_TYPES.map((ft) => (
                <button
                  key={ft}
                  type="button"
                  onClick={() => addField(ft)}
                  className="w-full text-start px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-950/20 transition-colors"
                >
                  {FIELD_TYPE_LABELS[ft].he}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Save as Template */}
        {fields.length > 0 && (
          <>
            {!showSaveTemplate ? (
              <button
                type="button"
                onClick={() => setShowSaveTemplate(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <IconSave />
                {'\u05E9\u05DE\u05D5\u05E8 \u05DB\u05D8\u05DE\u05E4\u05DC\u05D8'} {/* שמור כטמפלט */}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  className="input-sm text-xs w-36"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder={'\u05E9\u05DD \u05D4\u05D8\u05DE\u05E4\u05DC\u05D8'} /* שם הטמפלט */
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate || !templateName.trim()}
                  className="btn-primary text-xs py-1.5 px-3"
                >
                  {savingTemplate ? '...' : '\u05E9\u05DE\u05D5\u05E8'} {/* שמור */}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowSaveTemplate(false); setTemplateName(''); }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <IconClose />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Close add-menu on outside click */}
      {showAddMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setShowAddMenu(false)} />
      )}
    </div>
  );
}
