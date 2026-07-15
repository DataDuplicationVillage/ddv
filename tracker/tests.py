import json

from django.test import Client, TestCase

from tracker.models import DiskStatusLog, ReplicationLog


class ApiContractTests(TestCase):
    databases = {'default', 'replica'}

    def setUp(self):
        self.client = Client()

    def _post_json(self, path, payload):
        return self.client.post(path, data=json.dumps(payload), content_type='application/json')

    def _put_json(self, path, payload):
        return self.client.put(path, data=json.dumps(payload), content_type='application/json')

    def _create_contract_disk(self, disk_id='disk-contract-001', serial='SN-CONTRACT-001'):
        self.client.get('/api/datasources')
        return self._post_json(
            '/api/disks',
            {
                'id': disk_id,
                'hd_manufacturer': 'Seagate',
                'hd_model': 'IronWolf ST8000VN004',
                'hd_serial': serial,
                'hd_size': '8TB',
                'hd_speed': '7200 RPM',
                'source_requested_id': 'DS-A',
                'status': 'received',
                'received_time': '2026-07-14T10:00:00Z',
            },
        )

    def test_auth_login_contract(self):
        response = self._post_json('/api/auth/login', {'username': 'admin', 'password': 'admin123'})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body.get('success'))
        self.assertIn('user', body)
        self.assertEqual(body['user']['username'], 'admin')
        self.assertIn(body['user']['role'], {'admin', 'volunteer', 'processing', 'user'})
        self.assertTrue(body['user']['name'])

    def test_disk_lifecycle_and_kiosk_lookup_contract(self):
        # Ensure default reference data is present via API seeding behavior.
        sources_res = self.client.get('/api/datasources')
        self.assertEqual(sources_res.status_code, 200)
        self.assertGreaterEqual(len(sources_res.json()), 1)

        disk_id = 'disk-contract-001'
        create_res = self._create_contract_disk(disk_id=disk_id, serial='SN-CONTRACT-001')
        self.assertEqual(create_res.status_code, 201)
        self.assertEqual(create_res.json()['id'], disk_id)
        self.assertEqual(create_res.json()['status'], 'received')

        copying_res = self._put_json(
            f'/api/disks/{disk_id}',
            {'status': 'copying', 'operator': 'qa-suite'},
        )
        self.assertEqual(copying_res.status_code, 200)
        self.assertEqual(copying_res.json()['status'], 'copying')

        completed_res = self._put_json(
            f'/api/disks/{disk_id}',
            {'status': 'completed', 'operator': 'qa-suite'},
        )
        self.assertEqual(completed_res.status_code, 200)
        self.assertEqual(completed_res.json()['status'], 'completed')

        lookup_res = self.client.get(f'/api/kiosk/lookup-disk/{disk_id}')
        self.assertEqual(lookup_res.status_code, 200)
        lookup_body = lookup_res.json()
        self.assertTrue(lookup_body.get('found'))
        self.assertEqual(lookup_body.get('disk_id'), disk_id)
        self.assertGreaterEqual(len(lookup_body.get('status_logs', [])), 3)

        status_log_res = self.client.get(f'/api/disks/{disk_id}/status-logs')
        self.assertEqual(status_log_res.status_code, 200)
        statuses = [row['status'] for row in status_log_res.json()]
        self.assertIn('received', statuses)
        self.assertIn('copying', statuses)
        self.assertIn('completed', statuses)

        delete_res = self.client.delete(f'/api/disks/{disk_id}')
        self.assertEqual(delete_res.status_code, 200)
        self.assertTrue(delete_res.json().get('success'))

    def test_replication_stats_contract_shape(self):
        # Trigger at least one replication log entry.
        self._create_contract_disk(disk_id='disk-repl-001', serial='SN-REPL-001')

        stats_res = self.client.get('/api/admin/replication-stats')
        self.assertEqual(stats_res.status_code, 200)

        body = stats_res.json()
        self.assertIn('master_diskhavings_count', body)
        self.assertIn('replica_diskhavings_count', body)
        self.assertIn('logs', body)
        self.assertIsInstance(body['logs'], list)
        self.assertGreaterEqual(len(body['logs']), 1)

        first_log = body['logs'][0]
        self.assertIn('id', first_log)
        self.assertIn('timestamp', first_log)
        self.assertIn('action', first_log)
        self.assertIn('table_name', first_log)
        self.assertIn('record_id', first_log)
        self.assertIn('payload', first_log)

        self.assertGreaterEqual(ReplicationLog.objects.count(), 1)
        self.assertGreaterEqual(DiskStatusLog.objects.count(), 1)

    def test_auth_login_invalid_credentials(self):
        response = self._post_json('/api/auth/login', {'username': 'admin', 'password': 'wrong-password'})
        self.assertEqual(response.status_code, 401)
        self.assertFalse(response.json().get('success'))

    def test_disk_create_requires_id_and_serial(self):
        response = self._post_json('/api/disks', {'hd_manufacturer': 'Seagate'})
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.json())

    def test_disk_create_rejects_duplicate_id_and_serial(self):
        first = self._create_contract_disk(disk_id='disk-dupe-001', serial='SN-DUPE-001')
        self.assertEqual(first.status_code, 201)

        dup_id = self._create_contract_disk(disk_id='disk-dupe-001', serial='SN-DUPE-002')
        self.assertEqual(dup_id.status_code, 400)

        dup_serial = self._create_contract_disk(disk_id='disk-dupe-003', serial='SN-DUPE-001')
        self.assertEqual(dup_serial.status_code, 400)

    def test_missing_disk_endpoints_return_404_contract(self):
        update_res = self._put_json('/api/disks/not-a-disk', {'status': 'copying'})
        self.assertEqual(update_res.status_code, 404)

        delete_res = self.client.delete('/api/disks/not-a-disk')
        self.assertEqual(delete_res.status_code, 404)

        lookup_res = self.client.get('/api/kiosk/lookup-disk/not-a-disk')
        self.assertEqual(lookup_res.status_code, 404)
        self.assertFalse(lookup_res.json().get('found'))

    def test_admin_endpoints_negative_contracts(self):
        self.client.get('/api/datasources')

        load_test_res = self._post_json('/api/admin/generate-mock-load-test', {'count': 7})
        self.assertEqual(load_test_res.status_code, 400)

        lock_admin_res = self.client.delete('/api/admin/users/admin')
        self.assertEqual(lock_admin_res.status_code, 400)

        datasource_bad_res = self._post_json('/api/datasources', {'description': 'missing-name'})
        self.assertEqual(datasource_bad_res.status_code, 400)

    def test_frontend_bootstrap_and_route_integration_contract(self):
        # SPA host and fallback should return HTML while API remains JSON.
        root = self.client.get('/')
        fallback = self.client.get('/volunteer')
        self.assertEqual(root.status_code, 200)
        self.assertTrue(root['Content-Type'].startswith('text/html'))
        self.assertEqual(fallback.status_code, 200)
        self.assertTrue(fallback['Content-Type'].startswith('text/html'))

        # Frontend bootstrap data fetches should all return expected shapes.
        datasources = self.client.get('/api/datasources')
        disks = self.client.get('/api/disks')
        duplicators = self.client.get('/api/duplicators')
        users = self.client.get('/api/admin/users')

        self.assertEqual(datasources.status_code, 200)
        self.assertEqual(disks.status_code, 200)
        self.assertEqual(duplicators.status_code, 200)
        self.assertEqual(users.status_code, 200)

        ds_payload = datasources.json()
        self.assertIsInstance(ds_payload, list)
        self.assertGreaterEqual(len(ds_payload), 1)
        self.assertIn('id', ds_payload[0])
        self.assertIn('required_specs', ds_payload[0])

        self.assertIsInstance(disks.json(), list)
        self.assertIsInstance(duplicators.json(), list)
        self.assertIsInstance(users.json(), list)

        login = self._post_json('/api/auth/login', {'username': 'volunteer', 'password': 'vol123'})
        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.json().get('success'))

    def test_scan_label_contract(self):
        scan_response = self._post_json('/api/disks/scan-label', {'imageName': 'wd-label.jpg'})
        self.assertEqual(scan_response.status_code, 200)
        body = scan_response.json()
        self.assertTrue(body.get('success'))
        self.assertIn('data', body)
        self.assertIn('hd_manufacturer', body['data'])
        self.assertIn('hd_serial', body['data'])
