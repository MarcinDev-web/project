use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion, Throughput, black_box};

// Re-export functions from the crate
use collision::{batch_check_trs, Obb, obb_intersect as _ignore};

fn gen_data(n: usize) -> (Vec<f32>, Vec<f32>, Vec<f32>, Vec<f32>, Vec<f32>, Vec<f32>) {
    let mut pre_pos = vec![0.0, 0.0, 0.0];
    let mut pre_rot = vec![0.0, 0.0, 0.0, 1.0];
    let mut pre_scl = vec![1.0, 1.0, 1.0];
    let mut others_pos = vec![0.0f32; n * 3];
    let mut others_rot = vec![0.0f32; n * 4];
    let mut others_scl = vec![0.0f32; n * 3];
    for i in 0..n {
        let x = (i as f32 * 1.31).sin() * 5.0;
        let y = (i as f32 * 0.73).cos() * 5.0;
        let z = (i as f32 * 0.19).sin() * 5.0;
        others_pos[i * 3] = x;
        others_pos[i * 3 + 1] = y;
        others_pos[i * 3 + 2] = z;
        others_rot[i * 4 + 3] = 1.0; // identity rot
        others_scl[i * 3] = 1.0;
        others_scl[i * 3 + 1] = 1.0;
        others_scl[i * 3 + 2] = 1.0;
    }
    (pre_pos, pre_rot, pre_scl, others_pos, others_rot, others_scl)
}

fn bench_trs(c: &mut Criterion) {
    let mut group = c.benchmark_group("batch_check_trs");
    for &n in &[200usize, 500, 1000] {
        let (pre_pos, pre_rot, pre_scl, others_pos, others_rot, others_scl) = gen_data(n);
        group.throughput(Throughput::Elements(n as u64));
        group.bench_with_input(BenchmarkId::from_parameter(n), &n, |b, &_n| {
            b.iter(|| {
                let idx = batch_check_trs(
                    black_box(&pre_pos),
                    black_box(&pre_rot),
                    black_box(&pre_scl),
                    black_box(&others_pos),
                    black_box(&others_rot),
                    black_box(&others_scl),
                );
                black_box(idx);
            });
        });
    }
    group.finish();
}

criterion_group!(benches, bench_trs);
criterion_main!(benches);


