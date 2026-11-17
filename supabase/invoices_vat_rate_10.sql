-- Cap'Bat : corriger l'ancien défaut TVA 20 % → 10 %
-- Déjà appliqué en prod le 2026-11-17 ; fichier conservé pour traçabilité.

update public.invoices
set vat_rate = 10
where vat_rate = 20;
