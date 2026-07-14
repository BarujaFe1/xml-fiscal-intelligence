-- Private fiscal storage bucket (also created via dashboard/MCP if needed).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'xml-batches',
  'xml-batches',
  false,
  52428800,
  array['application/json','application/gzip','application/zip','text/plain','application/octet-stream']
)
on conflict (id) do update set public = excluded.public;
