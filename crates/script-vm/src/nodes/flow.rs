use crate::node::NodeBehavior;
use crate::signal::{Signal, SignalData};
use crate::vm::LogicExecutionContext;

pub struct DelayNode {
    pub delay_time: f32,
    pub active_delays: Vec<(f32, Signal)>,
}

impl NodeBehavior for DelayNode {
    fn on_signal(&mut self, port_id: u8, signal: &Signal, _ctx: &mut LogicExecutionContext) -> Option<Vec<(u8, Signal)>> {
        if port_id == 0 { // Input
            self.active_delays.push((self.delay_time, signal.clone()));
        }
        None
    }

    fn on_update(&mut self, dt: f32, _ctx: &mut LogicExecutionContext) -> Option<Vec<(u8, Signal)>> {
        if self.active_delays.is_empty() {
            return None;
        }

        let mut outputs = Vec::new();
        let mut remaining = Vec::new();

        for (time, signal) in self.active_delays.drain(..) {
            let new_time = time - dt;
            if new_time <= 0.0 {
                outputs.push((0, signal));
            } else {
                remaining.push((new_time, signal));
            }
        }

        self.active_delays = remaining;
        
        if outputs.is_empty() {
            None
        } else {
            Some(outputs)
        }
    }
}

pub struct TimerNode {
    pub duration: f32,
    pub current_time: f32,
    pub running: bool,
}

impl NodeBehavior for TimerNode {
    fn on_signal(&mut self, port_id: u8, signal: &Signal, _ctx: &mut LogicExecutionContext) -> Option<Vec<(u8, Signal)>> {
        match port_id {
            0 => { // Start
                self.running = true;
            },
            1 => { // Stop
                self.running = false;
            },
            2 => { // Reset
                self.current_time = 0.0;
                self.running = false;
            },
            _ => {}
        }
        None
    }

    fn on_update(&mut self, dt: f32, _ctx: &mut LogicExecutionContext) -> Option<Vec<(u8, Signal)>> {
        if !self.running {
            return None;
        }

        self.current_time += dt;

        let mut outputs: Vec<(u8, Signal)> = Vec::new();
        outputs.push((
            0,
            Signal {
                source_node: 0,
                source_port: 0,
                data: SignalData::Number(self.current_time as f64),
            },
        ));

        if self.current_time >= self.duration {
            self.running = false;
            self.current_time = 0.0; // Auto-reset? Or keep at max?

            outputs.push((1, Signal { // Output port 1: On Complete
                source_node: 0,
                source_port: 1,
                data: SignalData::None,
            }));
        }

        if outputs.is_empty() {
            None
        } else {
            Some(outputs)
        }
    }
}

