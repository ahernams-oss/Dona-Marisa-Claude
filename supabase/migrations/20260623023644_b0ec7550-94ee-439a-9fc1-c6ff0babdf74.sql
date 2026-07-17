UPDATE public.price_reports
SET product_key = trim(both '-' from regexp_replace(lower(product_key), '[^a-z0-9]+', '-', 'g'))
WHERE product_key ~ '[^a-z0-9-]';

UPDATE public.list_items
SET product_key = trim(both '-' from regexp_replace(lower(product_key), '[^a-z0-9]+', '-', 'g'))
WHERE product_key ~ '[^a-z0-9-]';