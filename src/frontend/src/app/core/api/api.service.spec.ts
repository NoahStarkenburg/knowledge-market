import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiService } from './api.service';
import type { ContentFileDto } from './types';

describe('ApiService', () => {
  let api: ApiService;
  let backend: HttpTestingController;
  let storagePut: ReturnType<typeof vi.fn>;

  const file = new File(['%PDF-1.4'], 'notes.pdf', { type: 'application/pdf' });
  const uploaded: ContentFileDto = { id: 'cf-1', fileTitle: 'notes.pdf', mimeType: 'application/pdf', fileSize: 8, storageKey: 'staged/u/g/notes.pdf' };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ApiService);
    backend = TestBed.inject(HttpTestingController);

    // The direct upload is a bare fetch to storage, not an HttpClient call to our API.
    storagePut = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', storagePut);
  });

  afterEach(() => {
    backend.verify();
    vi.unstubAllGlobals();
  });

  it('calls the API on the same origin with relative URLs', async () => {
    const course = api.getCourse('c1');
    backend.expectOne('/api/courses/c1').flush({ id: 'c1' });
    expect(await course).toEqual({ id: 'c1' });
  });

  it('uploads straight to storage with the headers the server returned, then confirms', async () => {
    const storageHeaders = { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'application/pdf' };
    const result = api.uploadFile('c1', file);

    const presign = backend.expectOne('/api/uploads/presign');
    expect(presign.request.body).toEqual({ fileName: 'notes.pdf', contentType: 'application/pdf' });
    presign.flush({ mode: 'direct', uploadUrl: 'https://blob.test/assets/k?sig=x', key: 'staged/u/g/notes.pdf', headers: storageHeaders });

    const confirm = await vi.waitFor(() => backend.expectOne('/api/uploads/confirm'));
    expect(confirm.request.body).toEqual({ key: 'staged/u/g/notes.pdf', fileName: 'notes.pdf', contentType: 'application/pdf' });
    confirm.flush(uploaded);

    expect(await result).toEqual(uploaded);
    expect(storagePut).toHaveBeenCalledWith('https://blob.test/assets/k?sig=x', { method: 'PUT', headers: storageHeaders, body: file });
  });

  it('uploads through the API when storage cannot presign', async () => {
    const result = api.uploadFile('c1', file);

    backend.expectOne('/api/uploads/presign').flush({ mode: 'proxy', uploadUrl: null, key: null, headers: null });

    const multipart = await vi.waitFor(() => backend.expectOne('/api/courses/c1/lessons/upload'));
    expect(multipart.request.body).toBeInstanceOf(FormData);
    multipart.flush(uploaded);

    expect(await result).toEqual(uploaded);
    expect(storagePut).not.toHaveBeenCalled();
  });

  it('falls back to uploading through the API when the direct upload fails', async () => {
    storagePut.mockResolvedValue({ ok: false, status: 403 });
    const result = api.uploadFile('c1', file);

    backend.expectOne('/api/uploads/presign').flush({ mode: 'direct', uploadUrl: 'https://blob.test/k', key: 'k', headers: {} });

    (await vi.waitFor(() => backend.expectOne('/api/courses/c1/lessons/upload'))).flush(uploaded);

    expect(await result).toEqual(uploaded);
    backend.expectNone('/api/uploads/confirm');
  });

  it('turns an HTTP error into an ApiError', async () => {
    const course = api.getCourse('missing');
    backend.expectOne('/api/courses/missing').flush({ title: 'Not found', detail: 'No such course' }, { status: 404, statusText: 'Not Found' });

    await expect(course).rejects.toMatchObject({ status: 404, title: 'Not found', detail: 'No such course' });
  });
});
