use std::collections::{HashMap, VecDeque};
use crate::node::{LogicNode, NodeType, NodeBehavior};
use crate::signal::{Signal, SignalData};
use crate::loader;

pub struct LogicExecutionContext<'a> {
    pub variables: &'a mut HashMap<String, SignalData>,
    pub side_effects: &'a mut Vec<f32>,
}

pub struct ScriptVM {
    nodes: HashMap<u32, LogicNode>,
    connections: HashMap<(u32, u8), Vec<(u32, u8)>>, // (source_node, source_port) -> [(target_node, target_port)]
    variables: HashMap<String, SignalData>,
    signal_queue: VecDeque<(u32, u8, Signal)>, // target_node, target_port, signal
    side_effects: Vec<f32>,
}

impl ScriptVM {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            connections: HashMap::new(),
            variables: HashMap::new(),
            signal_queue: VecDeque::new(),
            side_effects: Vec::new(),
        }
    }

    pub fn load_graph(&mut self, data: &[u8]) -> Result<(), String> {
        loader::load_graph(self, data)
    }

    pub fn add_node(&mut self, node: LogicNode) {
        self.nodes.insert(node.id, node);
    }

    pub fn add_connection(&mut self, src_node: u32, src_port: u8, target_node: u32, target_port: u8) {
        self.connections
            .entry((src_node, src_port))
            .or_default()
            .push((target_node, target_port));
    }
    
    pub fn set_variable(&mut self, name: String, value: SignalData) {
        self.variables.insert(name, value);
    }

    pub fn step(&mut self, dt: f32) -> Vec<f32> {
        self.side_effects.clear();
        
        // 1. Update phase
        let mut generated_signals = Vec::new();
        
        {
             let mut ctx = LogicExecutionContext {
                variables: &mut self.variables,
                side_effects: &mut self.side_effects,
            };
            
            for node in self.nodes.values_mut() {
                if let Some(signals) = node.behavior.on_update(dt, &mut ctx) {
                    for (port_out, signal) in signals {
                        generated_signals.push((node.id, port_out, signal));
                    }
                }
            }
        }
        
        for (src_node, src_port, signal) in generated_signals {
            self.emit_signal(src_node, src_port, signal);
        }

        // 2. Processing phase
        let max_signals = 1000;
        let mut processed = 0;
        
        while processed < max_signals {
            if self.signal_queue.is_empty() {
                break;
            }
            
            // Extract a batch of signals to avoid immutable borrow of self.signal_queue while mutably borrowing self.nodes
            // Actually, pop_front removes it, so we are good.
            let (target_id, target_port, signal) = self.signal_queue.pop_front().unwrap();
            processed += 1;
            
            // We need to collect outputs to avoid borrowing self.nodes and self.connections/queue at the same time
            let mut outputs = None;
            
            if let Some(node) = self.nodes.get_mut(&target_id) {
                let mut ctx = LogicExecutionContext {
                    variables: &mut self.variables,
                    side_effects: &mut self.side_effects,
                };
                outputs = node.behavior.on_signal(target_port, &signal, &mut ctx);
            }
            
            if let Some(out_signals) = outputs {
                for (port_out, out_signal) in out_signals {
                    self.emit_signal(target_id, port_out, out_signal);
                }
            }
        }
        
        self.side_effects.clone()
    }
    
    fn emit_signal(&mut self, src_node: u32, src_port: u8, mut signal: Signal) {
        signal.source_node = src_node;
        signal.source_port = src_port;

        if let Some(targets) = self.connections.get(&(src_node, src_port)) {
            for (target_node, target_port) in targets {
                self.signal_queue.push_back((*target_node, *target_port, signal.clone()));
            }
        }
    }
}
