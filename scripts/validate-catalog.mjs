#!/usr/bin/env node

import { readFileSync } from "node:fs";

const path = new URL("../model-catalog.json", import.meta.url);
const catalog = JSON.parse(readFileSync(path, "utf8"));
const identifier = /^[A-Za-z0-9._:-]{1,128}$/;
const rootFields = ["version", "updatedAt", "providers"];
const providerFields = ["id", "displayName", "models"];
const modelFields = ["id", "displayName", "status", "featured", "aliases"];

const rejectUnknownFields = (object, allowed, location) => {
  const unknown = Object.keys(object).filter(key => !allowed.includes(key));
  if (unknown.length > 0) throw new Error(`${location} contains unexpected fields: ${unknown.join(", ")}`);
};

rejectUnknownFields(catalog, rootFields, "Catalog");
if (catalog.version !== 1 || !Array.isArray(catalog.providers) || catalog.providers.length === 0) {
  throw new Error("Catalog must use schema version 1 and contain providers.");
}
if (!Number.isFinite(Date.parse(catalog.updatedAt))) {
  throw new Error("Catalog updatedAt must be an ISO-8601 date.");
}
if (catalog.providers.length > 20) throw new Error("Catalog may contain at most 20 providers.");

const providerIDs = new Set();
for (const provider of catalog.providers) {
  rejectUnknownFields(provider, providerFields, `Provider ${provider.id ?? "<unknown>"}`);
  if (!identifier.test(provider.id) || typeof provider.displayName !== "string" || !provider.displayName.trim()) {
    throw new Error("Invalid provider identity.");
  }
  if (providerIDs.has(provider.id.toLowerCase())) throw new Error(`Duplicate provider: ${provider.id}`);
  providerIDs.add(provider.id.toLowerCase());
  if (!Array.isArray(provider.models) || provider.models.length === 0 || provider.models.length > 100) {
    throw new Error(`Provider ${provider.id} must contain 1–100 models.`);
  }

  const modelIDs = new Set();
  for (const model of provider.models) {
    rejectUnknownFields(model, modelFields, `Model ${provider.id}/${model.id ?? "<unknown>"}`);
    if (!identifier.test(model.id) || typeof model.displayName !== "string" || !model.displayName.trim()) {
      throw new Error(`Invalid model in ${provider.id}.`);
    }
    if (!["active", "preview"].includes(model.status) || typeof model.featured !== "boolean") {
      throw new Error(`Invalid model status in ${provider.id}/${model.id}.`);
    }
    if (!Array.isArray(model.aliases) || model.aliases.length > 20 || model.aliases.some(alias => !identifier.test(alias))) {
      throw new Error(`Invalid aliases in ${provider.id}/${model.id}.`);
    }
    if (modelIDs.has(model.id.toLowerCase())) throw new Error(`Duplicate model: ${provider.id}/${model.id}`);
    modelIDs.add(model.id.toLowerCase());
  }
}

const modelCount = catalog.providers.reduce((sum, provider) => sum + provider.models.length, 0);
console.log(`Model catalog validation passed: ${catalog.providers.length} providers, ${modelCount} models.`);

