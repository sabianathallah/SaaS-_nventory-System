'use strict';
process.env.NODE_ENV = 'test';

// Unit test murni untuk poin kedisiplinan — tanpa DB, karena dailyScore()
// cuma fungsi dari (record attendance, setting company).
const { dailyScore, arrivalScore, expectedWorkMinutes } = require('../helpers/attendanceScore');
const { ALL_DEFAULTS } = require('../helpers/hrisSettings');

const SHIFT = { startTime: '09:00', endTime: '17:00' };
const at = (hhmm, day = '2026-09-22') => new Date(`${day}T${hhmm}:00+07:00`);

// Record hadir normal shift 09:00-17:00.
const day = (checkIn, checkOut, extra = {}) => ({
  status: 'PRESENT', workMode: 'ON_SITE', reviewStatus: 'NONE', lateExcuseStatus: 'NONE',
  autoCheckOut: false, shift: SHIFT,
  checkInAt: checkIn ? at(checkIn) : null,
  checkOutAt: checkOut ? at(checkOut) : null,
  ...extra,
});

const base = { ...ALL_DEFAULTS, minWorkMinutes: 480 };
const arrivalOnly = { ...base, workDurationWeight: 0 };
const durationOnly = { ...base, workDurationWeight: 100 };

describe('poin jam datang', () => {
  test.each([
    ['08:45', 100], ['09:00', 100],
    ['09:01', 90],  ['09:29', 90],
    ['09:30', 85],  ['09:45', 85],
    ['09:46', 80],  ['10:00', 80],
    ['10:01', 75],  ['13:00', 75],
  ])('datang %s -> %i poin', (jam, expected) => {
    expect(dailyScore(day(jam, '17:00'), arrivalOnly).score).toBe(expected);
  });

  test('tier dihitung dari jam shift, bukan dari toleransi telat', () => {
    // 09:10 masih dalam grace 15 menit (status PRESENT) tapi tetap tier 1.
    expect(dailyScore(day('09:10', '17:00'), { ...arrivalOnly, lateGraceMinutes: 15 }).score).toBe(90);
  });

  test('batas menit tier bisa diatur per company', () => {
    const strict = { ...arrivalOnly, lateTier1Max: 5, lateTier2Max: 8, lateTier3Max: 10 };
    expect(dailyScore(day('09:20', '17:00'), strict).score).toBe(strict.scoreLateTier4);
  });

  test('tanpa shift atau tanpa jam datang dianggap tepat waktu', () => {
    expect(arrivalScore(null, '09:00', arrivalOnly)).toBe(100);
    expect(arrivalScore(at('11:00'), null, arrivalOnly)).toBe(100);
  });
});

describe('poin lama jam kerja', () => {
  test.each([
    ['17:00', 100], // pas target 8 jam
    ['16:45', 90],  // kurang 15 menit
    ['16:00', 80],  // kurang 60 menit
    ['14:00', 70],  // kurang 3 jam
  ])('pulang %s -> %i poin', (jam, expected) => {
    expect(dailyScore(day('09:00', jam), durationOnly).score).toBe(expected);
  });

  test('belum check-out dinilai dari jam datang saja', () => {
    expect(dailyScore(day('09:40', null), durationOnly).score).toBe(base.scoreLateTier2);
  });

  test('lupa check-out tidak dapat kredit durasi penuh', () => {
    // Jam pulang diisi cron sampai jam akhir shift, jadi kalau dihitung penuh
    // diam-diam tidak check-out lebih untung daripada check-out jujur.
    const auto = dailyScore(day('09:00', '17:00', { autoCheckOut: true }), durationOnly).score;
    expect(auto).toBe(base.scoreWorkTier3);
    expect(auto).toBeLessThan(dailyScore(day('09:00', '17:00'), durationOnly).score);
  });

  test('target durasi ikut rentang shift, bukan setting company', () => {
    const paruhWaktu = { startTime: '09:00', endTime: '13:00' };
    expect(expectedWorkMinutes({ shift: paruhWaktu }, durationOnly)).toBe(240);
    // Shift 4 jam yang kerja penuh tidak boleh dihukum dengan target 8 jam.
    expect(dailyScore(day('09:00', '13:00', { shift: paruhWaktu }), durationOnly).score).toBe(100);
  });

  test('shift lintas tengah malam dihitung +24 jam', () => {
    expect(expectedWorkMinutes({ shift: { startTime: '22:00', endTime: '06:00' } }, durationOnly)).toBe(480);
  });

  test('tanpa shift jatuh ke minWorkMinutes', () => {
    expect(expectedWorkMinutes({ shift: null }, { ...durationOnly, minWorkMinutes: 300 })).toBe(300);
  });

  test('lembur bisa diberi poin di atas durasi penuh', () => {
    const reward = { ...durationOnly, scoreWorkOvertime: 120, workOvertimeMinMinutes: 60 };
    expect(dailyScore(day('09:00', '18:00'), reward).score).toBe(120); // lembur 60 menit
    expect(dailyScore(day('09:00', '17:30'), reward).score).toBe(100); // belum sampai ambang
  });
});

describe('campuran dua komponen', () => {
  test('bobot 0 mengabaikan durasi sama sekali', () => {
    expect(dailyScore(day('09:00', '12:00'), arrivalOnly).score).toBe(100);
  });

  test('bobot 50 mencampur jam datang dan durasi', () => {
    // jam datang 85 (telat 40 mnt), durasi 70 (kurang 3 jam) -> 78
    const mixed = { ...base, workDurationWeight: 50 };
    expect(dailyScore(day('09:40', '14:00'), mixed).score).toBe(78);
  });
});

describe('kasus khusus', () => {
  test('cuti tidak dihitung (hari netral)', () => {
    expect(dailyScore(day(null, null, { status: 'LEAVE' }), base)).toEqual({ counted: false });
  });

  test('absen = 0', () => {
    expect(dailyScore(day(null, null, { status: 'ABSENT' }), base)).toEqual({ score: 0, counted: true });
  });

  test('setengah hari pakai poin sendiri, tidak dicampur durasi', () => {
    expect(dailyScore(day('09:00', '12:00', { status: 'HALF_DAY' }), durationOnly).score).toBe(base.scoreHalfDay);
  });

  test('izin telat disetujui selalu di atas telat tanpa izin di jam yang sama', () => {
    const tanpaIzin = dailyScore(day('09:40', '17:00'), arrivalOnly).score;
    const denganIzin = dailyScore(day('09:40', '17:00', { lateExcuseStatus: 'APPROVED' }), arrivalOnly).score;
    expect(denganIzin).toBe(tanpaIzin + base.lateExcuseBonus);
    expect(denganIzin).toBeGreaterThan(tanpaIzin);
  });

  test('bonus izin telat tidak melewati poin tepat waktu', () => {
    expect(dailyScore(day('09:00', '17:00', { lateExcuseStatus: 'APPROVED' }), arrivalOnly).score)
      .toBe(base.scoreOnTime);
  });

  test('klaim lapangan: pending pakai skor sementara, ditolak 0, dinilai admin pakai fieldScore', () => {
    const field = (extra) => day('09:00', '17:00', { workMode: 'FIELD', ...extra });
    expect(dailyScore(field({ reviewStatus: 'PENDING_REVIEW' }), base).score).toBe(base.fieldPendingScore);
    expect(dailyScore(field({ reviewStatus: 'REJECTED' }), base).score).toBe(0);
    expect(dailyScore(field({ reviewStatus: 'APPROVED', fieldScore: 60 }), base).score).toBe(60);
    // Approved tanpa fieldScore = sudah di vendor saat absen -> dihitung normal.
    expect(dailyScore(field({ reviewStatus: 'APPROVED', fieldScore: null }), base).score).toBe(100);
  });
});
